import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId query parameter is required' },
        { status: 400 }
      );
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
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(savedListings);
  } catch (error) {
    console.error('Error fetching saved listings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch saved listings' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, listingId } = body;

    if (!userId || !listingId) {
      return NextResponse.json(
        { error: 'userId and listingId are required' },
        { status: 400 }
      );
    }

    // Check if listing exists
    const listing = await db.listing.findUnique({ where: { id: listingId } });
    if (!listing) {
      return NextResponse.json(
        { error: 'Listing not found' },
        { status: 404 }
      );
    }

    // Check if already saved
    const existingSave = await db.savedListing.findUnique({
      where: {
        userId_listingId: {
          userId,
          listingId,
        },
      },
    });

    if (existingSave) {
      return NextResponse.json(
        { error: 'Listing already saved' },
        { status: 409 }
      );
    }

    const savedListing = await db.savedListing.create({
      data: {
        userId,
        listingId,
      },
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
          },
        },
      },
    });

    return NextResponse.json(savedListing, { status: 201 });
  } catch (error) {
    console.error('Error saving listing:', error);
    return NextResponse.json(
      { error: 'Failed to save listing' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const listingId = searchParams.get('listingId');

    if (!userId || !listingId) {
      return NextResponse.json(
        { error: 'userId and listingId query parameters are required' },
        { status: 400 }
      );
    }

    const savedListing = await db.savedListing.findUnique({
      where: {
        userId_listingId: {
          userId,
          listingId,
        },
      },
    });

    if (!savedListing) {
      return NextResponse.json(
        { error: 'Saved listing not found' },
        { status: 404 }
      );
    }

    await db.savedListing.delete({
      where: {
        userId_listingId: {
          userId,
          listingId,
        },
      },
    });

    return NextResponse.json({ success: true, message: 'Listing unsaved' });
  } catch (error) {
    console.error('Error removing saved listing:', error);
    return NextResponse.json(
      { error: 'Failed to remove saved listing' },
      { status: 500 }
    );
  }
}
