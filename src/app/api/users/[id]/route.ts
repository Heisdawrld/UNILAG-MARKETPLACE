import { db, isDatabaseAvailable } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { optionalAuth, requireOwnership } from '@/lib/auth-guard';
import { rateLimits } from '@/lib/rate-limit';
import { validateBody, UserProfileUpdateSchema } from '@/lib/validation';
import { sanitizeText, sanitizeUsername, sanitizePhone, sanitizeDescription, sanitizeUrl } from '@/lib/sanitize';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1. Optional auth — public profile but hide sensitive fields for non-owners
  const { userId } = await optionalAuth()

  // 2. Rate limit
  const rl = await rateLimits.standard(request)
  if (!rl.success) return rl.response!

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

    // 3. Hide email, phone, whatsapp for non-owners (only show to the user themselves or admins)
    const isOwner = userId === id
    const result: Record<string, unknown> = {
      ...user,
      listingsCount: user._count.listings,
      reviewsGivenCount: user._count.reviewsGiven,
      reviewsReceivedCount: user._count.reviewsReceived,
      _count: undefined,
    }

    if (!isOwner) {
      delete result.email
      delete result.phone
      delete result.whatsapp
    }

    return NextResponse.json(result);
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
  const { id } = await params;

  // 1. Auth check — require ownership (only self or admin can update)
  const { errorResponse } = await requireOwnership(id)
  if (errorResponse) return errorResponse

  // 2. Rate limit
  const rl = await rateLimits.write(request)
  if (!rl.success) return rl.response!

  if (!isDatabaseAvailable()) {
    return NextResponse.json(
      { error: 'Database not configured. Please set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN environment variables.' },
      { status: 503 }
    );
  }
  try {
    const body = await request.json();

    // 3. Validate input
    const { data, error } = validateBody(UserProfileUpdateSchema, body)
    if (error) return error

    // Check if user exists
    const existingUser = await db.user.findUnique({ where: { id } });
    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check username uniqueness if changing
    if (data.username && data.username !== existingUser.username) {
      const usernameTaken = await db.user.findUnique({ where: { username: data.username } });
      if (usernameTaken) {
        return NextResponse.json(
          { error: 'Username already taken' },
          { status: 409 }
        );
      }
    }

    // 4. Sanitize all text inputs
    const updateData: Record<string, unknown> = {};
    if (data.username !== undefined) updateData.username = sanitizeUsername(data.username);
    if (data.avatar !== undefined) updateData.avatar = sanitizeUrl(data.avatar);
    if (data.faculty !== undefined) updateData.faculty = sanitizeText(data.faculty, 100);
    if (data.department !== undefined) updateData.department = sanitizeText(data.department, 100);
    if (data.level !== undefined) updateData.level = sanitizeText(data.level, 20);
    if (data.bio !== undefined) updateData.bio = sanitizeDescription(data.bio, 500);
    if (data.phone !== undefined) updateData.phone = sanitizePhone(data.phone);
    if (data.whatsapp !== undefined) updateData.whatsapp = sanitizePhone(data.whatsapp);
    if (data.hostel !== undefined) updateData.hostel = sanitizeText(data.hostel, 100);

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
