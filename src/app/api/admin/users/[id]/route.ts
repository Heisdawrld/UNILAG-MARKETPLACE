import { db, isDatabaseAvailable } from '@/lib/db';
import { requireAdminUser } from '@/lib/admin-auth';
import { NextRequest, NextResponse } from 'next/server';

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
    const adminResult = await requireAdminUser();
    if (!adminResult.ok) {
      return NextResponse.json({ error: adminResult.error }, { status: adminResult.status });
    }

    const { id } = await params;
    const body = await request.json();
    const { role, verificationStatus, trustScore, banned } = body;

    // Check if user exists
    const existingUser = await db.user.findUnique({ where: { id } });
    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (role !== undefined) {
      const validRoles = ['user', 'seller', 'vendor', 'admin'];
      if (!validRoles.includes(role)) {
        return NextResponse.json(
          { error: `Invalid role. Must be one of: ${validRoles.join(', ')}` },
          { status: 400 }
        );
      }
      updateData.role = role;
    }

    if (verificationStatus !== undefined) {
      const validStatuses = ['unverified', 'email_verified', 'unilag_verified'];
      if (!validStatuses.includes(verificationStatus)) {
        return NextResponse.json(
          { error: `Invalid verificationStatus. Must be one of: ${validStatuses.join(', ')}` },
          { status: 400 }
        );
      }
      updateData.verificationStatus = verificationStatus;
    }

    if (trustScore !== undefined) {
      updateData.trustScore = parseInt(trustScore);
    }

    // If banning, set trust score to -1
    if (banned === true) {
      updateData.trustScore = -1;
      updateData.verificationStatus = 'unverified';
    }

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
