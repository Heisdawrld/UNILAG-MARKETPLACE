import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db, isDatabaseAvailable } from '@/lib/db';
import { normalizeCoordinate } from '@/lib/runner-dispatch';

async function getAuthUser() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return null;

  return db.user.findUnique({
    where: { clerkId },
    select: { id: true, role: true, isRunner: true },
  });
}

export async function PATCH(request: NextRequest) {
  if (!isDatabaseAvailable()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }

  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!authUser.isRunner) {
      return NextResponse.json({ error: 'Only approved runners can update runner presence' }, { status: 403 });
    }

    const body = await request.json();
    const status = typeof body.status === 'string' ? body.status : '';
    const lat = normalizeCoordinate(body.lat);
    const lng = normalizeCoordinate(body.lng);

    if (!['offline', 'available', 'busy'].includes(status)) {
      return NextResponse.json({ error: 'Invalid runner availability status' }, { status: 400 });
    }

    const updatedUser = await db.user.update({
      where: { id: authUser.id },
      data: {
        runnerAvailabilityStatus: status,
        runnerLastActiveAt: new Date(),
        ...(lat !== null && lng !== null ? {
          runnerCurrentLat: lat,
          runnerCurrentLng: lng,
          runnerLocationUpdatedAt: new Date(),
        } : {}),
      },
      select: {
        runnerAvailabilityStatus: true,
        runnerLastActiveAt: true,
        runnerCurrentLat: true,
        runnerCurrentLng: true,
        runnerLocationUpdatedAt: true,
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error('[runner-presence PATCH]', error);
    return NextResponse.json({ error: 'Failed to update runner presence' }, { status: 500 });
  }
}
