import { db, isDatabaseAvailable } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  if (!isDatabaseAvailable()) {
    return NextResponse.json(
      { error: 'Database not configured. Please set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN environment variables.' },
      { status: 503 }
    );
  }
  try {
    const body = await request.json();
    const {
      username,
      email,
      password,
      faculty,
      department,
      level,
      phone,
      whatsapp,
      hostel,
      bio,
      clerkId,
    } = body;

    if (!username || !email) {
      return NextResponse.json(
        { error: 'Username and email are required' },
        { status: 400 }
      );
    }

    // If a clerkId is provided, check if a user with this clerkId already exists
    if (clerkId) {
      const existingByClerkId = await db.user.findUnique({
        where: { clerkId },
      });
      if (existingByClerkId) {
        // User already linked to this Clerk account, return existing user
        return NextResponse.json(
          {
            ...existingByClerkId,
            message: 'User already linked to Clerk account',
          },
          { status: 200 }
        );
      }
    }

    // Check if username already exists
    const existingUsername = await db.user.findUnique({ where: { username } });
    if (existingUsername) {
      // If clerkId is provided and the existing user has no clerkId, link them
      if (clerkId && !existingUsername.clerkId) {
        const updatedUser = await db.user.update({
          where: { id: existingUsername.id },
          data: {
            clerkId,
            verificationStatus: 'email_verified',
          },
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
            clerkId: true,
            createdAt: true,
            updatedAt: true,
          },
        });
        return NextResponse.json(updatedUser, { status: 200 });
      }
      return NextResponse.json(
        { error: 'Username already taken' },
        { status: 409 }
      );
    }

    // Check if email already exists
    const existingEmail = await db.user.findUnique({ where: { email } });
    if (existingEmail) {
      // If clerkId is provided and the existing user has no clerkId, link them
      if (clerkId && !existingEmail.clerkId) {
        const updatedUser = await db.user.update({
          where: { id: existingEmail.id },
          data: {
            clerkId,
            verificationStatus: 'email_verified',
          },
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
            clerkId: true,
            createdAt: true,
            updatedAt: true,
          },
        });
        return NextResponse.json(updatedUser, { status: 200 });
      }
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 409 }
      );
    }

    // Create new user (with optional clerkId linking)
    const user = await db.user.create({
      data: {
        username,
        email,
        clerkId: clerkId || null,
        faculty: faculty || null,
        department: department || null,
        level: level || null,
        phone: phone || null,
        whatsapp: whatsapp || null,
        hostel: hostel || null,
        bio: bio || null,
        verificationStatus: clerkId ? 'email_verified' : 'unverified',
        trustScore: 0,
        ratingAverage: 0,
        totalReviews: 0,
        role: 'user',
      },
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
        clerkId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    console.error('Error registering user:', error);
    return NextResponse.json(
      { error: 'Failed to register user' },
      { status: 500 }
    );
  }
}
