import { db, isDatabaseAvailable } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export async function GET(request: NextRequest) {
  if (!isDatabaseAvailable()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ error: 'Email query parameter is required' }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { email },
      select: {
        id: true, username: true, email: true, avatar: true,
        faculty: true, department: true, level: true, bio: true,
        phone: true, whatsapp: true, hostel: true,
        verificationStatus: true, trustScore: true,
        ratingAverage: true, totalReviews: true, role: true,
        isRunner: true, runnerRating: true, tasksCompleted: true,
        runnerAvailabilityStatus: true, runnerLastActiveAt: true,
        runnerCurrentLat: true, runnerCurrentLng: true, runnerLocationUpdatedAt: true,
        createdAt: true, updatedAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return NextResponse.json({ error: 'Failed to fetch user profile' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!isDatabaseAvailable()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }
  try {
    // ── SECURITY: verify Clerk session server-side ──
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized — please sign in' }, { status: 401 });
    }

    // Look up our DB user by their Clerk ID
    const authUser = await db.user.findUnique({ where: { clerkId } });
    if (!authUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { userId, username, avatar, bio, phone, whatsapp, faculty, department, level, hostel } = body;

    // ── SECURITY: ensure the user can only edit THEIR OWN profile ──
    if (userId && userId !== authUser.id) {
      return NextResponse.json({ error: 'Forbidden — cannot edit another user\'s profile' }, { status: 403 });
    }

    const updateData: Record<string, unknown> = {};
    if (username !== undefined) updateData.username = username;
    if (avatar !== undefined) updateData.avatar = avatar;
    if (bio !== undefined) updateData.bio = bio;
    if (phone !== undefined) updateData.phone = phone;
    if (whatsapp !== undefined) updateData.whatsapp = whatsapp;
    if (faculty !== undefined) updateData.faculty = faculty;
    if (department !== undefined) updateData.department = department;
    if (level !== undefined) updateData.level = level;
    if (hostel !== undefined) updateData.hostel = hostel;

    const user = await db.user.update({
      where: { id: authUser.id },
      data: updateData,
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}

