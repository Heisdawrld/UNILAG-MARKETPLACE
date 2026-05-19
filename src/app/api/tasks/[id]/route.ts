import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db, isDatabaseAvailable } from '@/lib/db';
import { attachRunnerPricingGuide } from '@/lib/runner-pricing';

async function getAuthUser() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return null;

  return db.user.findUnique({
    where: { clerkId },
    select: { id: true, role: true, isRunner: true },
  });
}

// GET /api/tasks/:id
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isDatabaseAvailable()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }

  const { id } = await params;

  try {
    const viewer = await getAuthUser();
    if (!viewer) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const task = await (db as any).task.findUnique({
      where: { id },
      include: {
        creator: {
          select: { id: true, username: true, avatar: true, verificationStatus: true, trustScore: true, hostel: true },
        },
        assignedRunner: {
          select: { id: true, username: true, avatar: true, runnerRating: true, tasksCompleted: true },
        },
        _count: { select: { applications: true } },
      },
    });

    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    let applications = [];

    if (viewer.role === 'admin' || viewer.id === task.creatorId) {
      applications = await (db as any).taskApplication.findMany({
        where: { taskId: id },
        include: {
          runner: {
            select: { id: true, username: true, avatar: true, runnerRating: true, tasksCompleted: true, trustScore: true, verificationStatus: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    } else {
      applications = await (db as any).taskApplication.findMany({
        where: { taskId: id, runnerId: viewer.id },
        include: {
          runner: {
            select: { id: true, username: true, avatar: true, runnerRating: true, tasksCompleted: true, trustScore: true, verificationStatus: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    return NextResponse.json({ ...attachRunnerPricingGuide(task), applications });
  } catch (err) {
    console.error('[tasks/:id GET]', err);
    return NextResponse.json({ error: 'Failed to fetch task' }, { status: 500 });
  }
}

// PATCH /api/tasks/:id — update status
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isDatabaseAvailable()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }

  const { id } = await params;

  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (authUser.role === 'banned') {
      return NextResponse.json({ error: 'Banned users cannot update tasks' }, { status: 403 });
    }

    const task = await (db as any).task.findUnique({
      where: { id },
      select: { id: true, creatorId: true, assignedRunnerId: true, status: true },
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const body = await req.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json({ error: 'status is required' }, { status: 400 });
    }

    const isAdmin = authUser.role === 'admin';
    const isCreator = authUser.id === task.creatorId;
    const isAssignedRunner = authUser.id === task.assignedRunnerId;

    if (status === 'cancelled') {
      if (!isAdmin && !isCreator) {
        return NextResponse.json({ error: 'Only the task creator can cancel this task' }, { status: 403 });
      }
    } else if (status === 'in_progress' || status === 'completed') {
      if (!isAdmin && !isAssignedRunner) {
        return NextResponse.json({ error: 'Only the assigned runner can update this task status' }, { status: 403 });
      }
    } else {
      return NextResponse.json({ error: 'Unsupported task status update' }, { status: 400 });
    }

    const updatedTask = await (db as any).task.update({
      where: { id },
      data: { status },
    });

    if (status === 'completed' && task.assignedRunnerId && task.status !== 'completed') {
      await (db as any).user.update({
        where: { id: task.assignedRunnerId },
        data: { tasksCompleted: { increment: 1 } },
      });
    }

    return NextResponse.json(attachRunnerPricingGuide(updatedTask));
  } catch (err) {
    console.error('[tasks/:id PATCH]', err);
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }
}

// DELETE /api/tasks/:id
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isDatabaseAvailable()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }

  const { id } = await params;

  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const task = await (db as any).task.findUnique({
      where: { id },
      select: { id: true, creatorId: true },
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    if (authUser.role !== 'admin' && authUser.id !== task.creatorId) {
      return NextResponse.json({ error: 'Only the task creator can delete this task' }, { status: 403 });
    }

    await (db as any).taskApplication.deleteMany({ where: { taskId: id } });
    await (db as any).task.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[tasks/:id DELETE]', err);
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
  }
}
