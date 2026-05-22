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

// POST /api/tasks/:id/apply — approved runner sends an offer on a runner request
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isDatabaseAvailable()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }

  const { id: taskId } = await params;

  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (authUser.role === 'banned') {
      return NextResponse.json({ error: 'Banned users cannot send offers on runner requests' }, { status: 403 });
    }

    const body = await req.json();
    const { runnerId, message, proposedPrice } = body;

    if (!runnerId) {
      return NextResponse.json({ error: 'runnerId is required' }, { status: 400 });
    }

    if (runnerId !== authUser.id) {
      return NextResponse.json({ error: 'Forbidden — you can only apply as yourself' }, { status: 403 });
    }

    if (!authUser.isRunner) {
      return NextResponse.json({ error: 'Only approved runners can send offers on runner requests' }, { status: 403 });
    }

    const parsedPrice = proposedPrice ? parseFloat(proposedPrice) : null;
    if (proposedPrice && (!Number.isFinite(parsedPrice) || parsedPrice! <= 0)) {
      return NextResponse.json({ error: 'Proposed price must be greater than zero' }, { status: 400 });
    }

    const task = await db.task.findUnique({ where: { id: taskId } });
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    if (task.status !== 'open') return NextResponse.json({ error: 'This runner request is no longer accepting offers' }, { status: 400 });
    if (task.creatorId === runnerId) return NextResponse.json({ error: 'You cannot offer on your own runner request' }, { status: 400 });

    const application = await db.taskApplication.upsert({
      where: { taskId_runnerId: { taskId, runnerId } },
      create: {
        taskId,
        runnerId,
        message: message?.trim() || null,
        proposedPrice: parsedPrice,
      },
      update: {
        message: message?.trim() || null,
        proposedPrice: parsedPrice,
        status: 'pending',
      },
      include: {
        runner: {
          select: { id: true, username: true, avatar: true, runnerRating: true, tasksCompleted: true, trustScore: true, verificationStatus: true },
        },
      },
    });

    await db.taskOffer.updateMany({
      where: {
        taskId,
        runnerId,
        status: 'open',
      },
      data: { status: 'superseded' },
    }).catch(() => null);

    await db.taskOffer.create({
      data: {
        taskId,
        runnerId,
        customerId: task.creatorId,
        amount: parsedPrice || task.reward,
        message: message?.trim() || null,
        createdByRole: 'runner',
        status: 'open',
      },
    }).catch(() => null);

    await db.task.update({
      where: { id: taskId },
      data: { negotiationStatus: 'negotiating' },
    }).catch(() => null);

    await notifyUser(task.creatorId, {
      title: '🏃 New Runner Offer!',
      body: `${authUser.username} wants to handle your request${parsedPrice ? ` for ₦${parsedPrice.toLocaleString()}` : ''}`,
      type: 'task_application',
      data: { taskId },
    });

    return NextResponse.json(application, { status: 201 });
  } catch (err) {
    console.error('[tasks/:id/apply POST]', err);
    return NextResponse.json({ error: 'Failed to send runner offer' }, { status: 500 });
  }
}

// PATCH /api/tasks/:id/apply — request creator accepts or rejects an offer
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isDatabaseAvailable()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }

  const { id: taskId } = await params;

  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { applicationId, action } = body;

    if (!applicationId || !action) {
      return NextResponse.json({ error: 'applicationId and action are required' }, { status: 400 });
    }

    if (!['accept', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const task = await db.task.findUnique({
      where: { id: taskId },
      select: { id: true, creatorId: true, status: true },
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    if (authUser.role !== 'admin' && authUser.id !== task.creatorId) {
      return NextResponse.json({ error: 'Only the task creator can review offers' }, { status: 403 });
    }

    const application = await db.taskApplication.findUnique({
      where: { id: applicationId },
      include: {
        runner: {
          select: { id: true, username: true, role: true, isRunner: true },
        },
      },
    });

    if (!application || application.taskId !== taskId) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    if (action === 'accept') {
      if (task.status !== 'open') {
        return NextResponse.json({ error: 'This runner request is no longer open for selection' }, { status: 400 });
      }

      if (!application.runner?.isRunner || application.runner.role === 'banned') {
        return NextResponse.json({ error: 'This applicant is not an approved runner' }, { status: 400 });
      }

      const finalReward = application.proposedPrice && application.proposedPrice > 0 ? application.proposedPrice : undefined;

      await Promise.all([
        db.taskApplication.update({
          where: { id: applicationId },
          data: { status: 'accepted' },
        }),
        db.taskApplication.updateMany({
          where: { taskId, id: { not: applicationId } },
          data: { status: 'rejected' },
        }),
        db.task.update({
          where: { id: taskId },
          data: {
            status: 'matched',
            negotiationStatus: 'matched',
            assignedRunnerId: application.runnerId,
            ...(finalReward ? { reward: finalReward } : {}),
            matchedAt: new Date(),
          },
        }),
        db.taskOffer.updateMany({
          where: { taskId, runnerId: application.runnerId, status: 'open' },
          data: { status: 'accepted' },
        }).catch(() => ({ count: 0 })),
        db.taskOffer.updateMany({
          where: { taskId, runnerId: { not: application.runnerId }, status: 'open' },
          data: { status: 'expired' },
        }).catch(() => ({ count: 0 })),
        db.user.update({
          where: { id: application.runnerId },
          data: { runnerAvailabilityStatus: 'busy' },
        }).catch(() => null),
      ]);

      await notifyUser(application.runnerId, {
        title: '🎉 Runner Offer Accepted!',
        body: 'Your runner offer was accepted. Open Runner to continue.',
        type: 'task_accepted',
        data: { taskId },
        requireInteraction: true,
      });
    } else {
      await db.taskApplication.update({
        where: { id: applicationId },
        data: { status: 'rejected' },
      });

      await notifyUser(application.runnerId, {
        title: 'Runner Offer Declined',
        body: 'Your offer was not accepted for this runner request.',
        type: 'system',
        data: { taskId },
      });
    }

    return NextResponse.json({ success: true, action });
  } catch (err) {
    console.error('[tasks/:id/apply PATCH]', err);
    return NextResponse.json({ error: 'Failed to update application' }, { status: 500 });
  }
}
