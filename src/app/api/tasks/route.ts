import { NextRequest, NextResponse } from 'next/server';
import { db, isDatabaseAvailable } from '@/lib/db';
import { auth } from '@clerk/nextjs/server';

// GET /api/tasks — list tasks with filters
export async function GET(req: NextRequest) {
  if (!isDatabaseAvailable()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') || 'open';
  const category = searchParams.get('category') || '';
  const urgency = searchParams.get('urgency') || '';
  const search = searchParams.get('search') || '';
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
  const creatorId = searchParams.get('creatorId') || '';

  try {
    const where: Record<string, unknown> = {};
    if (status && status !== 'all') where.status = status;
    if (category) where.category = category;
    if (urgency) where.urgency = urgency;
    if (creatorId) where.creatorId = creatorId;
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
        { location: { contains: search } },
      ];
    }

    const tasks = await (db as any).task.findMany({
      where,
      take: limit,
      orderBy: [{ urgency: 'desc' }, { createdAt: 'desc' }],
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            avatar: true,
            verificationStatus: true,
            trustScore: true,
            hostel: true,
          },
        },
        assignedRunner: {
          select: {
            id: true,
            username: true,
            avatar: true,
            runnerRating: true,
            tasksCompleted: true,
          },
        },
        _count: { select: { applications: true } },
      },
    });

    return NextResponse.json({ tasks });
  } catch (err) {
    console.error('[tasks GET]', err);
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }
}

// POST /api/tasks — create a task
export async function POST(req: NextRequest) {
  if (!isDatabaseAvailable()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }

  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const authUser = await db.user.findUnique({
      where: { clerkId },
      select: { id: true, role: true },
    });

    if (!authUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (authUser.role === 'banned') {
      return NextResponse.json({ error: 'Banned users cannot post tasks' }, { status: 403 });
    }

    const body = await req.json();
    const { creatorId, title, description, reward, category, location, pickupLocation, urgency, deadline, images } = body;

    if (!creatorId || !title || !description || !reward || !category) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (creatorId !== authUser.id) {
      return NextResponse.json({ error: 'Forbidden — you can only create tasks as yourself' }, { status: 403 });
    }

    const parsedReward = parseFloat(reward);
    if (!Number.isFinite(parsedReward) || parsedReward <= 0) {
      return NextResponse.json({ error: 'Reward must be a valid amount greater than zero' }, { status: 400 });
    }

    const task = await (db as any).task.create({
      data: {
        creatorId,
        title: title.trim(),
        description: description.trim(),
        reward: parsedReward,
        category,
        location: location?.trim() || null,
        pickupLocation: pickupLocation?.trim() || null,
        urgency: urgency || 'medium',
        deadline: deadline ? new Date(deadline) : null,
        images: JSON.stringify(images || []),
      },
      include: {
        creator: {
          select: { id: true, username: true, avatar: true, verificationStatus: true, trustScore: true, hostel: true },
        },
      },
    });

    return NextResponse.json(task, { status: 201 });
  } catch (err) {
    console.error('[tasks POST]', err);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}
