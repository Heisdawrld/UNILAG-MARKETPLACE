import { NextRequest, NextResponse } from 'next/server';
import { db, isDatabaseAvailable } from '@/lib/db';

// POST /api/tasks/:id/apply — runner applies for a task
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isDatabaseAvailable()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }

  const { id: taskId } = await params;

  try {
    const body = await req.json();
    const { runnerId, message, proposedPrice } = body;

    if (!runnerId) {
      return NextResponse.json({ error: 'runnerId is required' }, { status: 400 });
    }

    // Check task is still open
    const task = await (db as any).task.findUnique({ where: { id: taskId } });
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    if (task.status !== 'open') return NextResponse.json({ error: 'Task is no longer accepting applications' }, { status: 400 });
    if (task.creatorId === runnerId) return NextResponse.json({ error: 'You cannot apply to your own task' }, { status: 400 });

    // Create application (upsert in case they already applied)
    const application = await (db as any).taskApplication.upsert({
      where: { taskId_runnerId: { taskId, runnerId } },
      create: { taskId, runnerId, message: message?.trim() || null, proposedPrice: proposedPrice ? parseFloat(proposedPrice) : null },
      update: { message: message?.trim() || null, proposedPrice: proposedPrice ? parseFloat(proposedPrice) : null, status: 'pending' },
      include: {
        runner: {
          select: { id: true, username: true, avatar: true, runnerRating: true, tasksCompleted: true, trustScore: true, verificationStatus: true },
        },
      },
    });

    // Mark runner as isRunner if not already
    await (db as any).user.update({
      where: { id: runnerId },
      data: { isRunner: true },
    });

    return NextResponse.json(application, { status: 201 });
  } catch (err) {
    console.error('[tasks/:id/apply POST]', err);
    return NextResponse.json({ error: 'Failed to apply for task' }, { status: 500 });
  }
}

// PATCH /api/tasks/:id/apply — accept or reject an application
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isDatabaseAvailable()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }

  const { id: taskId } = await params;

  try {
    const body = await req.json();
    const { applicationId, action } = body; // action: 'accept' | 'reject'

    if (!applicationId || !action) {
      return NextResponse.json({ error: 'applicationId and action are required' }, { status: 400 });
    }

    const application = await (db as any).taskApplication.findUnique({ where: { id: applicationId } });
    if (!application) return NextResponse.json({ error: 'Application not found' }, { status: 404 });

    if (action === 'accept') {
      // Accept this runner, reject all others, assign runner to task
      // If runner proposed a price, update the task reward to that price
      const finalReward = application.proposedPrice || undefined;
      await Promise.all([
        (db as any).taskApplication.update({
          where: { id: applicationId },
          data: { status: 'accepted' },
        }),
        (db as any).taskApplication.updateMany({
          where: { taskId, id: { not: applicationId } },
          data: { status: 'rejected' },
        }),
        (db as any).task.update({
          where: { id: taskId },
          data: {
            status: 'assigned',
            assignedRunnerId: application.runnerId,
            ...(finalReward ? { reward: finalReward } : {}),
          },
        }),
      ]);

      // Notify the runner they got accepted
      try {
        await (db as any).notification.create({
          data: {
            userId: application.runnerId,
            type: 'task_accepted',
            title: '🎉 Task Accepted!',
            message: `Your offer was accepted! Check your active tasks.`,
            data: JSON.stringify({ taskId }),
          },
        });
      } catch {}
    } else {
      await (db as any).taskApplication.update({
        where: { id: applicationId },
        data: { status: 'rejected' },
      });
    }

    return NextResponse.json({ success: true, action });
  } catch (err) {
    console.error('[tasks/:id/apply PATCH]', err);
    return NextResponse.json({ error: 'Failed to update application' }, { status: 500 });
  }
}
