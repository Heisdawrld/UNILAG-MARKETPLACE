import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const listing = await db.listing.findUnique({
      where: { id },
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
            phone: true,
            whatsapp: true,
            hostel: true,
          },
        },
      },
    });

    if (!listing) {
      return NextResponse.json(
        { error: 'Listing not found' },
        { status: 404 }
      );
    }

    // Increment views
    await db.listing.update({
      where: { id },
      data: { views: { increment: 1 } },
    });

    // Return listing with incremented view count
    return NextResponse.json({
      ...listing,
      views: listing.views + 1,
    });
  } catch (error) {
    console.error('Error fetching listing:', error);
    return NextResponse.json(
      { error: 'Failed to fetch listing' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, description, price, category, condition, negotiable, location, status, images } = body;

    // Check if listing exists
    const existingListing = await db.listing.findUnique({ where: { id } });
    if (!existingListing) {
      return NextResponse.json(
        { error: 'Listing not found' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (price !== undefined) updateData.price = parseFloat(price);
    if (category !== undefined) updateData.category = category;
    if (condition !== undefined) updateData.condition = condition;
    if (negotiable !== undefined) updateData.negotiable = negotiable;
    if (location !== undefined) updateData.location = location;
    if (status !== undefined) updateData.status = status;
    if (images !== undefined) updateData.images = JSON.stringify(images);

    const updatedListing = await db.listing.update({
      where: { id },
      data: updateData,
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
    });

    return NextResponse.json(updatedListing);
  } catch (error) {
    console.error('Error updating listing:', error);
    return NextResponse.json(
      { error: 'Failed to update listing' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Soft delete by setting status to removed
    await db.listing.update({
      where: { id },
      data: { status: 'removed' },
    });

    return NextResponse.json({ success: true, message: 'Listing removed' });
  } catch (error) {
    console.error('Error deleting listing:', error);
    return NextResponse.json(
      { error: 'Failed to delete listing' },
      { status: 500 }
    );
  }
}
