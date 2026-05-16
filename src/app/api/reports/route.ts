import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { reporterId, listingId, reason } = body;

    if (!reporterId || !reason) {
      return NextResponse.json(
        { error: 'reporterId and reason are required' },
        { status: 400 }
      );
    }

    // Validate reason
    const validReasons = ['scam', 'fake_listing', 'harassment', 'spam', 'illegal_item'];
    if (!validReasons.includes(reason)) {
      return NextResponse.json(
        { error: `Invalid reason. Must be one of: ${validReasons.join(', ')}` },
        { status: 400 }
      );
    }

    // Check if reporter exists
    const reporter = await db.user.findUnique({ where: { id: reporterId } });
    if (!reporter) {
      return NextResponse.json(
        { error: 'Reporter not found' },
        { status: 404 }
      );
    }

    // If listingId is provided, verify the listing exists
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
        reporterId,
        listingId: listingId || null,
        reason,
        status: 'pending',
      },
      include: {
        reporter: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
        listing: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    // Create notification for admin
    const admins = await db.user.findMany({
      where: { role: 'admin' },
    });

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
