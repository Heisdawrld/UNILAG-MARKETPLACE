import { NextRequest, NextResponse } from 'next/server';
import { db, isDatabaseAvailable } from '@/lib/db';
import { auth } from '@clerk/nextjs/server';
import { attachRunnerPricingGuide } from '@/lib/runner-pricing';
import { estimateCampusTrip, normalizeCoordinate, validateCampusRoute } from '@/lib/runner-dispatch';
import { notifyUsers } from '@/lib/push';
import { rateLimits } from '@/lib/rate-limit';

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
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
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

    const skip = (page - 1) * limit;

    const [tasks, total] = await Promise.all([
      db.task.findMany({
        where,
        skip,
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
          offers: {
            orderBy: { createdAt: 'desc' },
            take: 8,
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
          },
          _count: { select: { applications: true } },
        },
      }),
      db.task.count({ where }),
    ]);

    return NextResponse.json({
      tasks: tasks.map((task: any) => attachRunnerPricingGuide(task)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error('[tasks GET]', err);
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }
}

// POST /api/tasks — create a task
export async function POST(req: NextRequest) {
  // Rate limit
  const rl = await rateLimits.write(req)
  if (!rl.success) return rl.response!

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
      return NextResponse.json({ error: 'Banned users cannot post runner requests' }, { status: 403 });
    }

    const body = await req.json();
    const {
      creatorId,
      title,
      description,
      reward,
      category,
      location,
      pickupLocation,
      pickupLabel,
      dropoffLabel,
      pickupLat,
      pickupLng,
      dropoffLat,
      dropoffLng,
      urgency,
      deadline,
      images,
    } = body;

    if (!creatorId || !title || !description || !reward || !category) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (creatorId !== authUser.id) {
      return NextResponse.json({ error: 'Forbidden — you can only create tasks as yourself' }, { status: 403 });
    }

    if (typeof title === 'string' && title.length > 200) {
      return NextResponse.json({ error: 'Title must be 200 characters or fewer' }, { status: 400 });
    }
    if (typeof description === 'string' && description.length > 5000) {
      return NextResponse.json({ error: 'Description must be 5000 characters or fewer' }, { status: 400 });
    }

    const parsedReward = parseFloat(reward);
    if (!Number.isFinite(parsedReward) || parsedReward <= 0) {
      return NextResponse.json({ error: 'Reward must be a valid amount greater than zero' }, { status: 400 });
    }
    if (parsedReward > 1_000_000) {
      return NextResponse.json({ error: 'Reward cannot exceed ₦1,000,000' }, { status: 400 });
    }

    const pickup = {
      lat: normalizeCoordinate(pickupLat),
      lng: normalizeCoordinate(pickupLng),
    };
    const dropoff = {
      lat: normalizeCoordinate(dropoffLat),
      lng: normalizeCoordinate(dropoffLng),
    };

    const hasPickupCoords = pickup.lat !== null && pickup.lng !== null;
    const hasDropoffCoords = dropoff.lat !== null && dropoff.lng !== null;
    const hasAnyCoords = hasPickupCoords || hasDropoffCoords;

    if (hasAnyCoords) {
      const routeValidation = validateCampusRoute(
        hasPickupCoords ? { lat: pickup.lat!, lng: pickup.lng! } : null,
        hasDropoffCoords ? { lat: dropoff.lat!, lng: dropoff.lng! } : null,
      );
      if (!routeValidation.ok) {
        return NextResponse.json({ error: routeValidation.error }, { status: 400 });
      }
    }

    const tripEstimate = hasPickupCoords && hasDropoffCoords
      ? estimateCampusTrip(
          { lat: pickup.lat!, lng: pickup.lng! },
          { lat: dropoff.lat!, lng: dropoff.lng! },
        )
      : null;

    const task = await db.task.create({
      data: {
        creatorId,
        title: title.trim(),
        description: description.trim(),
        reward: parsedReward,
        category,
        location: location?.trim() || null,
        pickupLocation: pickupLocation?.trim() || null,
        pickupLabel: pickupLabel?.trim() || pickupLocation?.trim() || null,
        dropoffLabel: dropoffLabel?.trim() || location?.trim() || null,
        pickupLat: hasPickupCoords ? pickup.lat! : null,
        pickupLng: hasPickupCoords ? pickup.lng! : null,
        dropoffLat: hasDropoffCoords ? dropoff.lat! : null,
        dropoffLng: hasDropoffCoords ? dropoff.lng! : null,
        serviceArea: 'unilag',
        negotiationStatus: 'open',
        urgency: urgency || 'medium',
        deadline: deadline ? new Date(deadline) : null,
        images: JSON.stringify(images || []),
        estimatedDistanceMeters: tripEstimate?.estimatedDistanceMeters || null,
        estimatedDurationMinutes: tripEstimate?.estimatedDurationMinutes || null,
      },
      include: {
        creator: {
          select: { id: true, username: true, avatar: true, verificationStatus: true, trustScore: true, hostel: true },
        },
      },
    });

    const availableRunners = await db.user.findMany({
      where: {
        isRunner: true,
        role: { not: 'banned' },
        runnerAvailabilityStatus: 'available',
      },
      select: { id: true },
    });

    await notifyUsers(
      availableRunners.map((runner) => runner.id),
      {
        title: 'New Runner Request',
        body: `${title.trim()} • ₦${parsedReward.toLocaleString()} • ${pickupLabel?.trim() || pickupLocation?.trim() || 'Pickup'} to ${dropoffLabel?.trim() || location?.trim() || 'Dropoff'}`,
        type: 'runner_request_broadcast',
        tag: `runner-request-${task.id}`,
        data: { taskId: task.id, tab: 'tasks' },
        requireInteraction: true,
      },
    );

    return NextResponse.json(attachRunnerPricingGuide(task), { status: 201 });
  } catch (err) {
    console.error('[tasks POST]', err);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}
