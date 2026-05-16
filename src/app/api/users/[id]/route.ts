import { db, isDatabaseAvailable } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isDatabaseAvailable()) {
    return NextResponse.json(
      { error: 'Database not configured. Please set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN environment variables.' },
      { status: 503 }
    );
  }
  try {
    const { id } = await params;

    const user = await db.user.findUnique({
      where: { id },
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
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            listings: true,
            reviewsGiven: true,
            reviewsReceived: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ...user,
      listingsCount: user._count.listings,
      reviewsGivenCount: user._count.reviewsGiven,
      reviewsReceivedCount: user._count.reviewsReceived,
      _count: undefined,
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isDatabaseAvailable()) {
    return NextResponse.json(
      { error: 'Database not configured. Please set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN environment variables.' },
      { status: 503 }
    );
  }
  try {
    const { id } = await params;
    const body = await request.json();
    const { username, avatar, faculty, department, level, bio, phone, whatsapp, hostel } = body;

    // Check if user exists
    const existingUser = await db.user.findUnique({ where: { id } });
    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check username uniqueness if changing
    if (username && username !== existingUser.username) {
      const usernameTaken = await db.user.findUnique({ where: { username } });
      if (usernameTaken) {
        return NextResponse.json(
          { error: 'Username already taken' },
          { status: 409 }
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    if (username !== undefined) updateData.username = username;
    if (avatar !== undefined) updateData.avatar = avatar;
    if (faculty !== undefined) updateData.faculty = faculty;
    if (department !== undefined) updateData.department = department;
    if (level !== undefined) updateData.level = level;
    if (bio !== undefined) updateData.bio = bio;
    if (phone !== undefined) updateData.phone = phone;
    if (whatsapp !== undefined) updateData.whatsapp = whatsapp;
    if (hostel !== undefined) updateData.hostel = hostel;

    const updatedUser = await db.user.update({
      where: { id },
      data: updateData,
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
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}
