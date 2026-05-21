import { auth } from '@clerk/nextjs/server';
import { db, isDatabaseAvailable } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

const clerkPubKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || '';
const clerkSecKey = process.env.CLERK_SECRET_KEY || '';
const isClerkConfigured = !!(
  clerkPubKey &&
  clerkSecKey &&
  clerkPubKey !== 'undefined' &&
  clerkSecKey !== 'undefined' &&
  clerkPubKey.startsWith('pk_')
);

async function getAuthUser() {
  if (!isClerkConfigured) {
    return null;
  }

  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return null;
  }

  return db.user.findUnique({ where: { clerkId }, select: { id: true, role: true } });
}

export async function GET(request: NextRequest) {
  if (!isDatabaseAvailable()) {
    return NextResponse.json(
      { error: 'Database not configured. Please set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN environment variables.' },
      { status: 503 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId query parameter is required' }, { status: 400 });
    }

    const authUser = await getAuthUser();
    if (isClerkConfigured && !authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (authUser && userId !== authUser.id) {
      return NextResponse.json({ error: 'Forbidden — cannot read another user\'s saved listings' }, { status: 403 });
    }

    const savedListings = await db.savedListing.findMany({
      where: { userId },
      include: {
        listing: {
          include: {
            seller: {
              select: {
                id: true,
                username: true,
                avatar: true,
                faculty: true,
                department: true,
                verificationStatus: true,
                ratingAverage: true,
              },
            },
            store: {
              select: {
                id: true,
                name: true,
                logo: true,
                slug: true,
                isVerified: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(savedListings);
  } catch (error) {
    console.error('Error fetching saved listings:', error);
    return NextResponse.json({ error: 'Failed to fetch saved listings' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!isDatabaseAvailable()) {
    return NextResponse.json(
      { error: 'Database not configured. Please set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN environment variables.' },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const { userId, listingId } = body;

    if (!userId || !listingId) {
      return NextResponse.json({ error: 'userId and listingId are required' }, { status: 400 });
    }

    const authUser = await getAuthUser();
    if (isClerkConfigured && !authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (authUser?.role === 'banned') {
      return NextResponse.json({ error: 'Banned users cannot save listings' }, { status: 403 });
    }

    if (authUser && userId !== authUser.id) {
      return NextResponse.json({ error: 'Forbidden — cannot save listings for another user' }, { status: 403 });
    }

    const listing = await db.listing.findUnique({ where: { id: listingId } });
    if (!listing || listing.status !== 'active') {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    const existingSave = await db.savedListing.findUnique({
      where: { userId_listingId: { userId, listingId } },
    });

    if (existingSave) {
      return NextResponse.json({ error: 'Listing already saved' }, { status: 409 });
    }

    const savedListing = await db.savedListing.create({
      data: { userId, listingId },
      include: {
        listing: {
          include: {
            seller: {
              select: {
                id: true,
                username: true,
                avatar: true,
                faculty: true,
                department: true,
                verificationStatus: true,
                ratingAverage: true,
              },
            },
            store: {
              select: {
                id: true,
                name: true,
                logo: true,
                slug: true,
                isVerified: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(savedListing, { status: 201 });
  } catch (error) {
    console.error('Error saving listing:', error);
    return NextResponse.json({ error: 'Failed to save listing' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!isDatabaseAvailable()) {
    return NextResponse.json(
      { error: 'Database not configured. Please set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN environment variables.' },
      { status: 503 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const listingId = searchParams.get('listingId');

    if (!userId || !listingId) {
      return NextResponse.json({ error: 'userId and listingId query parameters are required' }, { status: 400 });
    }

    const authUser = await getAuthUser();
    if (isClerkConfigured && !authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (authUser && userId !== authUser.id) {
      return NextResponse.json({ error: 'Forbidden — cannot unsave listings for another user' }, { status: 403 });
    }

    const savedListing = await db.savedListing.findUnique({
      where: { userId_listingId: { userId, listingId } },
    });

    if (!savedListing) {
      return NextResponse.json({ error: 'Saved listing not found' }, { status: 404 });
    }

    await db.savedListing.delete({
      where: { userId_listingId: { userId, listingId } },
    });

    return NextResponse.json({ success: true, message: 'Listing unsaved' });
  } catch (error) {
    console.error('Error removing saved listing:', error);
    return NextResponse.json({ error: 'Failed to remove saved listing' }, { status: 500 });
  }
}
