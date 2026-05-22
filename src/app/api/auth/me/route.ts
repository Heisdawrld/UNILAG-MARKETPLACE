import { auth } from '@clerk/nextjs/server';
import { db, isDatabaseAvailable } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { findUserProfileById } from '@/lib/user-profile';

export async function GET(request: NextRequest) {
  if (!isDatabaseAvailable()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const authUser = await db.user.findUnique({ where: { clerkId }, select: { id: true } });
    if (!authUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const user = await findUserProfileById(authUser.id);

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
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized — please sign in' }, { status: 401 });
    }

    const authUser = await db.user.findUnique({ where: { clerkId } });
    if (!authUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { userId, username, avatar, bio, phone, whatsapp, faculty, department, level, hostel } = body;

    if (userId && userId !== authUser.id) {
      return NextResponse.json({ error: 'Forbidden — cannot edit another user\'s profile' }, { status: 403 });
    }

    if (typeof bio === 'string' && bio.length > 500) {
      return NextResponse.json({ error: 'Bio must be 500 characters or fewer' }, { status: 400 });
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

    const profile = await findUserProfileById(user.id);
    return NextResponse.json(profile ?? user);
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
