import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db, isDatabaseAvailable } from '@/lib/db';
import { notifyUser } from '@/lib/push';

async function getAuthUser() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return null;

  return db.user.findUnique({
    where: { clerkId },
    select: { id: true, username: true, role: true, isRunner: true },
  });
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isDatabaseAvailable()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }

  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: taskId } = await params;
    const task = await db.task.findUnique({
      where: { id: taskId },
      select: { id: true, creatorId: true, assignedRunnerId: true },
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const isCreator = authUser.id === task.creatorId;
    const isAssignedRunner = authUser.id === task.assignedRunnerId;
    const isRunnerViewer = authUser.isRunner;

    const offers = await db.taskOffer.findMany({
      where: isCreator || isAssignedRunner || authUser.role === 'admin'
        ? { taskId }
        : isRunnerViewer
          ? { taskId, runnerId: authUser.id }
          : { taskId, customerId: authUser.id },
      orderBy: { createdAt: 'desc' },
      include: {
        runner: {
          select: {
            id: true,
            username: true,
            avatar: true,
            runnerRating: true,
            tasksCompleted: true,
            trustScore: true,
            verificationStatus: true,
          },
        },
        customer: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    return NextResponse.json({ offers });
  } catch (error) {
    console.error('[tasks/:id/offers GET]', error);
    return NextResponse.json({ error: 'Failed to fetch offers' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isDatabaseAvailable()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }

  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: taskId } = await params;
    const task = await db.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        title: true,
        reward: true,
        creatorId: true,
        status: true,
        negotiationStatus: true,
        assignedRunnerId: true,
      },
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    if (task.status === 'cancelled' || task.status === 'completed') {
      return NextResponse.json({ error: 'This runner request is closed' }, { status: 400 });
    }

    if (task.creatorId === authUser.id) {
      return NextResponse.json({ error: 'Customers cannot create runner offers as runners' }, { status: 400 });
    }

    if (!authUser.isRunner || authUser.role === 'banned') {
      return NextResponse.json({ error: 'Only approved runners can send runner offers' }, { status: 403 });
    }

    const body = await request.json();
    const amount = Number(body.amount ?? body.proposedPrice ?? task.reward);
    const message = typeof body.message === 'string' ? body.message.trim() : '';

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Offer amount must be greater than zero' }, { status: 400 });
    }

    await db.taskOffer.updateMany({
      where: {
        taskId,
        runnerId: authUser.id,
        status: 'open',
      },
      data: { status: 'superseded' },
    });

    const offer = await db.taskOffer.create({
      data: {
        taskId,
        runnerId: authUser.id,
        customerId: task.creatorId,
        amount,
        message: message || null,
        createdByRole: 'runner',
        status: 'open',
      },
      include: {
        runner: {
          select: {
            id: true,
            username: true,
            avatar: true,
            runnerRating: true,
            tasksCompleted: true,
            trustScore: true,
            verificationStatus: true,
          },
        },
      },
    });

    await db.task.update({
      where: { id: taskId },
      data: { negotiationStatus: 'negotiating' },
    });

    await notifyUser(task.creatorId, {
      title: 'New Runner Offer',
      body: `${authUser.username} offered ₦${amount.toLocaleString()} for ${task.title}`,
      type: 'task_offer',
      data: { taskId, tab: 'tasks' },
      requireInteraction: true,
    });

    return NextResponse.json(offer, { status: 201 });
  } catch (error) {
    console.error('[tasks/:id/offers POST]', error);
    return NextResponse.json({ error: 'Failed to create runner offer' }, { status: 500 });
  }
}
