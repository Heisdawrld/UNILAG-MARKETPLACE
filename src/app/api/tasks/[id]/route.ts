import { NextRequest, NextResponse } from 'next/server';
import { db, isDatabaseAvailable } from '@/lib/db';

// GET /api/tasks/:id
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isDatabaseAvailable()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }

  const { id } = await params;

  try {
    const task = await (db as any).task.findUnique({
      where: { id },
      include: {
        creator: {
          select: { id: true, username: true, avatar: true, verificationStatus: true, trustScore: true, hostel: true, phone: true, whatsapp: true },
        },
        assignedRunner: {
          select: { id: true, username: true, avatar: true, runnerRating: true, tasksCompleted: true },
        },
        applications: {
          include: {
            runner: {
              select: { id: true, username: true, avatar: true, runnerRating: true, tasksCompleted: true, trustScore: true, verificationStatus: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { applications: true } },
      },
    });

    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    return NextResponse.json(task);
  } catch (err) {
    console.error('[tasks/:id GET]', err);
    return NextResponse.json({ error: 'Failed to fetch task' }, { status: 500 });
  }
}

// PATCH /api/tasks/:id — update status or assign runner
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isDatabaseAvailable()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const { status, assignedRunnerId } = body;

    const updateData: Record<string, unknown> = {};
    if (status) updateData.status = status;
    if (assignedRunnerId !== undefined) updateData.assignedRunnerId = assignedRunnerId;

    const task = await (db as any).task.update({
      where: { id },
      data: updateData,
    });

    // If task is completed, increment runner's tasksCompleted
    if (status === 'completed' && task.assignedRunnerId) {
      await (db as any).user.update({
        where: { id: task.assignedRunnerId },
        data: { tasksCompleted: { increment: 1 } },
      });
    }

    return NextResponse.json(task);
  } catch (err) {
    console.error('[tasks/:id PATCH]', err);
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }
}

// DELETE /api/tasks/:id
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isDatabaseAvailable()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }

  const { id } = await params;

  try {
    await (db as any).task.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[tasks/:id DELETE]', err);
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
  }
}
