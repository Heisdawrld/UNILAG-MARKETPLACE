import { db, isDatabaseAvailable } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  if (!isDatabaseAvailable()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const demoUser = await db.user.findFirst({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      username: true,
      email: true,
      avatar: true,
      faculty: true,
      department: true,
      level: true,
      bio: true,
      phone: true,
      whatsapp: true,
      hostel: true,
      verificationStatus: true,
      trustScore: true,
      ratingAverage: true,
      totalReviews: true,
      role: true,
      isRunner: true,
      runnerRating: true,
      tasksCompleted: true,
      runnerAvailabilityStatus: true,
      runnerLastActiveAt: true,
      runnerCurrentLat: true,
      runnerCurrentLng: true,
      runnerLocationUpdatedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!demoUser) {
    return NextResponse.json({ error: 'No demo user found' }, { status: 404 });
  }

  return NextResponse.json(demoUser);
}
