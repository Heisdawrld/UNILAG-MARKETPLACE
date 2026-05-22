import { auth } from '@clerk/nextjs/server';
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
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const authUser = await db.user.findUnique({ where: { clerkId }, select: { id: true } });
    if (!authUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { listingId, reason } = body;

    if (!reason) {
      return NextResponse.json(
        { error: 'reason is required' },
        { status: 400 }
      );
    }

    const validReasons = ['scam', 'fake_listing', 'harassment', 'spam', 'illegal_item'];
    if (!validReasons.includes(reason)) {
      return NextResponse.json(
        { error: `Invalid reason. Must be one of: ${validReasons.join(', ')}` },
        { status: 400 }
      );
    }

    if (listingId) {
      const listing = await db.listing.findUnique({ where: { id: listingId } });
      if (!listing) {
        return NextResponse.json(
          { error: 'Listing not found' },
          { status: 404 }
        );
      }
    }

    const report = await db.report.create({
      data: {
        reporterId: authUser.id,
        listingId: listingId || null,
        reason,
        status: 'pending',
      },
      include: {
        reporter: {
          select: { id: true, username: true, avatar: true },
        },
        listing: {
          select: { id: true, title: true },
        },
      },
    });

    const admins = await db.user.findMany({ where: { role: 'admin' } });

    await db.notification.createMany({
      data: admins.map((admin) => ({
        userId: admin.id,
        type: 'new_report',
        title: 'New Report',
        message: `A new report has been submitted: ${reason}`,
      })),
    });

    return NextResponse.json(report, { status: 201 });
  } catch (error) {
    console.error('Error creating report:', error);
    return NextResponse.json(
      { error: 'Failed to create report' },
      { status: 500 }
    );
  }
}
