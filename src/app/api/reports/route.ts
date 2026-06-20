import { auth } from '@clerk/nextjs/server';
import { db, isDatabaseAvailable } from '@/lib/db';
import { validateBody, ReportCreateSchema } from '@/lib/validation';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimits } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  // Rate limit
  const rl = await rateLimits.write(request)
  if (!rl.success) return rl.response!

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

    // Validate request body with Zod schema
    const { data, error: validationError } = validateBody(ReportCreateSchema, body);
    if (validationError) return validationError;

    const { listingId, reason } = data;

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
