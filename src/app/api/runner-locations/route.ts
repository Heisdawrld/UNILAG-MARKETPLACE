import { NextRequest, NextResponse } from 'next/server';
import { db, isDatabaseAvailable } from '@/lib/db';
import { auth } from '@clerk/nextjs/server';

export async function GET(_req: NextRequest) {
  if (!isDatabaseAvailable()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }

  try {
    const { userId: clerkId } = await auth();

    const runners = await db.user.findMany({
      where: {
        isRunner: true,
        role: { not: 'banned' },
        runnerCurrentLat: { not: null },
        runnerCurrentLng: { not: null },
        runnerLocationUpdatedAt: {
          gte: new Date(Date.now() - 1000 * 60 * 15),
        },
      },
      select: {
        id: true,
        username: true,
        avatar: true,
        runnerCurrentLat: true,
        runnerCurrentLng: true,
        runnerLocationUpdatedAt: true,
        runnerAvailabilityStatus: true,
        runnerRating: true,
      },
      orderBy: { runnerLocationUpdatedAt: 'desc' },
      take: 50,
    });

    let userLocation: { lat: number; lng: number; updatedAt: Date | null } | null = null;
    if (clerkId) {
      const user = await db.user.findUnique({
        where: { clerkId },
        select: { runnerCurrentLat: true, runnerCurrentLng: true, runnerLocationUpdatedAt: true },
      });
      if (user?.runnerCurrentLat != null && user?.runnerCurrentLng != null) {
        userLocation = {
          lat: user.runnerCurrentLat,
          lng: user.runnerCurrentLng,
          updatedAt: user.runnerLocationUpdatedAt,
        };
      }
    }

    return NextResponse.json({ runners, userLocation });
  } catch (error) {
    console.error('[runner-locations GET]', error);
    return NextResponse.json({ error: 'Failed to fetch runner locations' }, { status: 500 });
  }
}
