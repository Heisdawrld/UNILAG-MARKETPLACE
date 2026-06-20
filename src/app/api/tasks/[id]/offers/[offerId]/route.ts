import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db, isDatabaseAvailable } from '@/lib/db';
import { notifyUser } from '@/lib/push';
import { getTaskLifecycleTimestamps } from '@/lib/runner-dispatch';

async function getAuthUser() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return null;

  return db.user.findUnique({
    where: { clerkId },
    select: { id: true, username: true, role: true, isRunner: true },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; offerId: string }> },
) {
  if (!isDatabaseAvailable()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }

  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: taskId, offerId } = await params;
    const task = await db.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        title: true,
        creatorId: true,
        status: true,
        assignedRunnerId: true,
      },
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const offer = await db.taskOffer.findUnique({
      where: { id: offerId },
      include: {
        runner: {
          select: { id: true, username: true, isRunner: true, role: true },
        },
      },
    });

    if (!offer || offer.taskId !== taskId) {
      return NextResponse.json({ error: 'Offer not found' }, { status: 404 });
    }

    const body = await request.json();
    const action = typeof body.action === 'string' ? body.action : '';

    if (!['accept', 'reject', 'counter'].includes(action)) {
      return NextResponse.json({ error: 'Invalid offer action' }, { status: 400 });
    }

    if (action === 'counter') {
      if (authUser.id !== task.creatorId && authUser.role !== 'admin') {
        return NextResponse.json({ error: 'Only the customer can counter an offer' }, { status: 403 });
      }

      const amount = Number(body.amount);
      const message = typeof body.message === 'string' ? body.message.trim() : '';
      if (!Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json({ error: 'Counter amount must be greater than zero' }, { status: 400 });
      }

      await db.taskOffer.updateMany({
        where: { taskId, runnerId: offer.runnerId, status: 'open' },
        data: { status: 'superseded' },
      });

      const counterOffer = await db.taskOffer.create({
        data: {
          taskId,
          runnerId: offer.runnerId,
          customerId: task.creatorId,
          amount,
          message: message || null,
          createdByRole: 'customer',
          status: 'open',
        },
      });

      await notifyUser(offer.runnerId, {
        title: 'Customer Counter Offer',
        body: `${authUser.username} countered with ₦${amount.toLocaleString()} for ${task.title}`,
        type: 'task_offer_counter',
        data: { taskId, tab: 'tasks' },
        requireInteraction: true,
      });

      return NextResponse.json(counterOffer);
    }

    if (authUser.id !== task.creatorId && authUser.role !== 'admin') {
      return NextResponse.json({ error: 'Only the customer can review runner offers' }, { status: 403 });
    }

    if (action === 'reject') {
      await db.taskOffer.update({
        where: { id: offerId },
        data: { status: 'rejected' },
      });

      await notifyUser(offer.runnerId, {
        title: 'Runner Offer Declined',
        body: 'Your runner offer was declined.',
        type: 'system',
        data: { taskId, tab: 'tasks' },
      });

      return NextResponse.json({ success: true, action });
    }

    if (!offer.runner.isRunner || offer.runner.role === 'banned') {
      return NextResponse.json({ error: 'This offer is no longer valid because the runner is unavailable' }, { status: 400 });
    }

    // Use atomic conditional update to prevent double-assignment
    const lifecycle = getTaskLifecycleTimestamps('matched');

    const assignmentResult = await db.task.updateMany({
      where: { id: taskId, assignedRunnerId: null },
      data: {
        reward: offer.amount,
        assignedRunnerId: offer.runnerId,
        status: 'matched',
        negotiationStatus: 'matched',
        ...lifecycle,
      },
    });

    if (assignmentResult.count === 0) {
      return NextResponse.json({ error: 'Task already assigned' }, { status: 409 });
    }

    // Assignment succeeded — update related records
    await Promise.all([
      db.taskOffer.update({
        where: { id: offerId },
        data: { status: 'accepted' },
      }),
      db.taskOffer.updateMany({
        where: { taskId, id: { not: offerId }, status: 'open' },
        data: { status: 'expired' },
      }),
      db.taskApplication.updateMany({
        where: { taskId, runnerId: offer.runnerId },
        data: { status: 'accepted', proposedPrice: offer.amount },
      }).catch(() => ({ count: 0 })),
      db.taskApplication.updateMany({
        where: { taskId, runnerId: { not: offer.runnerId } },
        data: { status: 'rejected' },
      }).catch(() => ({ count: 0 })),
      db.user.update({
        where: { id: offer.runnerId },
        data: { runnerAvailabilityStatus: 'busy' },
      }),
    ]);

    await notifyUser(offer.runnerId, {
      title: 'Runner Offer Accepted',
      body: `You were matched for ${task.title}. Open Runner to continue.`,
      type: 'task_accepted',
      data: { taskId, tab: 'tasks' },
      requireInteraction: true,
    });

    return NextResponse.json({ success: true, action: 'accept' });
  } catch (error) {
    console.error('[tasks/:id/offers/:offerId PATCH]', error);
    return NextResponse.json({ error: 'Failed to update runner offer' }, { status: 500 });
  }
}
