import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db, isDatabaseAvailable } from '@/lib/db';
import { isInsideUnilagBoundary, normalizeCoordinate } from '@/lib/runner-dispatch';

async function getAuthUser() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return null;

  return db.user.findUnique({
    where: { clerkId },
    select: { id: true, isRunner: true, role: true },
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
      return NextResponse.json({ error: 'Only approved runners can share live location' }, { status: 403 });
    }

    const body = await request.json();
    const lat = normalizeCoordinate(body.lat);
    const lng = normalizeCoordinate(body.lng);

    if (lat === null || lng === null) {
      return NextResponse.json({ error: 'lat and lng are required' }, { status: 400 });
    }

    if (!isInsideUnilagBoundary({ lat, lng })) {
      return NextResponse.json({ error: 'Runner live location must stay within the UNILAG service area' }, { status: 400 });
    }

    const updatedUser = await db.user.update({
      where: { id: authUser.id },
      data: {
        runnerCurrentLat: lat,
        runnerCurrentLng: lng,
        runnerLocationUpdatedAt: new Date(),
        runnerLastActiveAt: new Date(),
      },
      select: {
        runnerCurrentLat: true,
        runnerCurrentLng: true,
        runnerLocationUpdatedAt: true,
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error('[runner-location PATCH]', error);
    return NextResponse.json({ error: 'Failed to update runner location' }, { status: 500 });
  }
}
