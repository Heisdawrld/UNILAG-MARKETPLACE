import { db, isDatabaseAvailable } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { notifyUser } from '@/lib/push';

// GET /api/admin/stats — dashboard overview
export async function GET(req: NextRequest) {
  if (!isDatabaseAvailable()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    // ── SECURITY: verify Clerk session & Admin role ──
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const admin = await db.user.findUnique({ where: { clerkId } });
    if (!admin || admin.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
    const [
      totalUsers, totalListings, activeListings, soldListings,
      totalReviews, totalReports, pendingReports, totalChats,
      totalTasks,
    ] = await Promise.all([
      db.user.count(),
      db.listing.count(),
      db.listing.count({ where: { status: 'active' } }),
      db.listing.count({ where: { status: 'sold' } }),
      db.review.count(),
      db.report.count(),
      db.report.count({ where: { status: 'pending' } }),
      db.chat.count(),
      (db as any).task.count().catch(() => 0),
    ]);

    const recentUsers = await db.user.findMany({
      orderBy: { createdAt: 'desc' }, take: 10,
      select: { id: true, username: true, email: true, avatar: true, role: true, verificationStatus: true, trustScore: true, isRunner: true, createdAt: true },
    });

    const recentReports = await db.report.findMany({
      where: { status: 'pending' }, orderBy: { createdAt: 'desc' }, take: 10,
      include: { reporter: { select: { username: true } }, listing: { select: { title: true, id: true } } },
    });

    const allUsers = await db.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, username: true, email: true, avatar: true, role: true, verificationStatus: true, trustScore: true, ratingAverage: true, totalReviews: true, isRunner: true, phone: true, faculty: true, hostel: true, createdAt: true },
    });

    const allListings = await db.listing.findMany({
      orderBy: { createdAt: 'desc' }, take: 50,
      include: { seller: { select: { username: true, id: true } } },
    });

    return NextResponse.json({
      stats: { totalUsers, totalListings, activeListings, soldListings, totalReviews, totalReports, pendingReports, totalChats, totalTasks },
      recentUsers, recentReports, allUsers, allListings,
    });
  } catch (err) {
    console.error('[admin stats]', err);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}

// PATCH /api/admin/stats — admin actions (verify user, ban, approve runner, resolve report)
export async function PATCH(req: NextRequest) {
  if (!isDatabaseAvailable()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    // ── SECURITY: verify Clerk session & Admin role ──
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const admin = await db.user.findUnique({ where: { clerkId } });
    if (!admin || admin.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await req.json();
    const { action, targetId, data } = body;

    switch (action) {
      case 'verify_user':
        await db.user.update({ where: { id: targetId }, data: { verificationStatus: 'unilag_verified' } });
        return NextResponse.json({ success: true, message: 'User verified' });

      case 'ban_user':
        await db.user.update({ where: { id: targetId }, data: { role: 'banned', trustScore: 0 } });
        return NextResponse.json({ success: true, message: 'User banned' });

      case 'unban_user':
        await db.user.update({ where: { id: targetId }, data: { role: 'user' } });
        return NextResponse.json({ success: true, message: 'User unbanned' });

      case 'make_admin':
        await db.user.update({ where: { id: targetId }, data: { role: 'admin' } });
        return NextResponse.json({ success: true, message: 'User made admin' });

      case 'approve_runner':
        await db.user.update({
          where: { id: targetId },
          data: { isRunner: true, trustScore: { increment: 10 } },
        });
        await db.notification.deleteMany({
          where: {
            type: 'runner_application',
            OR: [
              { data: { contains: `"applicantId":"${targetId}"` } },
              { message: { contains: `"applicantId":"${targetId}"` } },
            ],
          },
        });
        await notifyUser(targetId, {
          title: 'Runner Application Approved ✅',
          body: 'You are now an approved runner. You can start bidding on campus tasks.',
          type: 'system',
          data: { url: '/?tab=tasks' },
        });
        return NextResponse.json({ success: true, message: 'Runner approved' });

      case 'reject_runner':
        await db.user.update({ where: { id: targetId }, data: { isRunner: false } });
        await db.notification.deleteMany({
          where: {
            type: 'runner_application',
            OR: [
              { data: { contains: `"applicantId":"${targetId}"` } },
              { message: { contains: `"applicantId":"${targetId}"` } },
            ],
          },
        });
        await notifyUser(targetId, {
          title: 'Runner Application Declined',
          body: 'Your runner application was not approved yet. Update your details and apply again.',
          type: 'system',
          data: { url: '/?tab=tasks' },
        });
        return NextResponse.json({ success: true, message: 'Runner rejected' });

      case 'remove_listing':
        await db.listing.update({ where: { id: targetId }, data: { status: 'removed' } });
        return NextResponse.json({ success: true, message: 'Listing removed' });

      case 'resolve_report':
        await db.report.update({ where: { id: targetId }, data: { status: data?.status || 'resolved' } });
        return NextResponse.json({ success: true, message: 'Report resolved' });

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (err) {
    console.error('[admin action]', err);
    return NextResponse.json({ error: 'Action failed' }, { status: 500 });
  }
}
