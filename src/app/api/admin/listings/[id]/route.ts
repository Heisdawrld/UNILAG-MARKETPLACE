import { db, isDatabaseAvailable } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function DELETE(
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

    // Check if listing exists
    const existingListing = await db.listing.findUnique({ where: { id } });
    if (!existingListing) {
      return NextResponse.json(
        { error: 'Listing not found' },
        { status: 404 }
      );
    }

    // Remove listing by setting status to removed
    await db.listing.update({
      where: { id },
      data: { status: 'removed' },
    });

    // Notify the seller
    await db.notification.create({
      data: {
        userId: existingListing.sellerId,
        type: 'item_sold',
        title: 'Listing Removed',
        message: `Your listing "${existingListing.title}" has been removed by an admin`,
      },
    });

    return NextResponse.json({ success: true, message: 'Listing removed' });
  } catch (error) {
    console.error('Error removing listing:', error);
    return NextResponse.json(
      { error: 'Failed to remove listing' },
      { status: 500 }
    );
  }
}
