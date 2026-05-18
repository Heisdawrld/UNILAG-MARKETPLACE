import { auth } from '@clerk/nextjs/server';
import { db, isDatabaseAvailable } from '@/lib/db';
import { enhanceMarketplaceImages } from '@/lib/image-processing';
import { NextRequest, NextResponse } from 'next/server';

async function getAuthUser() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return null;

  return db.user.findUnique({
    where: { clerkId },
    select: { id: true, role: true },
  });
}

export async function GET(
  _request: NextRequest,
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
    const viewer = await getAuthUser();

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
        store: {
          select: {
            id: true,
            name: true,
            logo: true,
            slug: true,
            isVerified: true,
            phone: true,
            whatsapp: true,
          },
        },
      },
    });

    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    if (listing.status === 'removed' && (!viewer || (viewer.id !== listing.sellerId && viewer.role !== 'admin'))) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    if (!viewer || viewer.id !== listing.sellerId) {
      await db.listing.update({
        where: { id },
        data: { views: { increment: 1 } },
      });
    }

    return NextResponse.json({
      ...listing,
      views: (!viewer || viewer.id !== listing.sellerId) ? listing.views + 1 : listing.views,
    });
  } catch (error) {
    console.error('Error fetching listing:', error);
    return NextResponse.json({ error: 'Failed to fetch listing' }, { status: 500 });
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
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { title, description, price, category, condition, negotiable, location, status, images } = body;

    const existingListing = await db.listing.findUnique({ where: { id } });
    if (!existingListing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    if (authUser.role !== 'admin' && authUser.id !== existingListing.sellerId) {
      return NextResponse.json({ error: 'Forbidden — you can only edit your own listing' }, { status: 403 });
    }

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = String(title).trim();
    if (description !== undefined) updateData.description = String(description).trim();
    if (price !== undefined) {
      const parsedPrice = parseFloat(price);
      if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
        return NextResponse.json({ error: 'Price must be greater than zero' }, { status: 400 });
      }
      updateData.price = parsedPrice;
    }
    if (category !== undefined) updateData.category = category;
    if (condition !== undefined) updateData.condition = condition;
    if (negotiable !== undefined) updateData.negotiable = negotiable;
    if (location !== undefined) updateData.location = typeof location === 'string' && location.trim() ? location.trim() : null;
    if (status !== undefined) updateData.status = status;
    if (images !== undefined) {
      const processedImages = await enhanceMarketplaceImages(images, { maxWidth: 1600, maxHeight: 1600, quality: 84 });
      updateData.images = JSON.stringify(processedImages);
    }

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
        store: {
          select: {
            id: true,
            name: true,
            logo: true,
            slug: true,
            isVerified: true,
            phone: true,
            whatsapp: true,
          },
        },
      },
    });

    return NextResponse.json(updatedListing);
  } catch (error) {
    console.error('Error updating listing:', error);
    return NextResponse.json({ error: 'Failed to update listing' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isDatabaseAvailable()) {
    return NextResponse.json(
      { error: 'Database not configured. Please set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN environment variables.' },
      { status: 503 }
    );
  }
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const existingListing = await db.listing.findUnique({ where: { id } });
    if (!existingListing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    if (authUser.role !== 'admin' && authUser.id !== existingListing.sellerId) {
      return NextResponse.json({ error: 'Forbidden — you can only delete your own listing' }, { status: 403 });
    }

    await db.listing.update({ where: { id }, data: { status: 'removed' } });
    return NextResponse.json({ success: true, message: 'Listing removed' });
  } catch (error) {
    console.error('Error deleting listing:', error);
    return NextResponse.json({ error: 'Failed to delete listing' }, { status: 500 });
  }
}
