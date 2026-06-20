import { db, isDatabaseAvailable } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { notifyUser } from '@/lib/push';
import { requireAdminUser } from '@/lib/admin-auth';
import {
  RUNNER_APPLICATION_TYPE,
  buildRunnerApplicationMessage,
  buildRunnerApplicationTitle,
  getLatestRunnerApplicationForApplicant,
  groupRunnerApplications,
  serializeRunnerApplication,
} from '@/lib/runner-applications';
import type { RunnerApplicationStatus } from '@/lib/types';

async function updateRunnerApplicationReviewStatus({
  applicantId,
  applicationId,
  status,
  reviewedBy,
  reviewedByName,
  reviewNote,
}: {
  applicantId: string;
  applicationId?: string;
  status: RunnerApplicationStatus;
  reviewedBy: string;
  reviewedByName: string;
  reviewNote?: string;
}) {
  const notifications = await db.notification.findMany({
    where: {
      type: RUNNER_APPLICATION_TYPE,
      data: {
        contains: applicationId
          ? `"applicationId":"${applicationId}"`
          : `"applicantId":"${applicantId}"`,
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const applications = groupRunnerApplications(notifications);
  const application = applicationId
    ? applications.find((item) => item.applicationId === applicationId)
    : getLatestRunnerApplicationForApplicant(applications, applicantId);

  if (!application) return null;

  const reviewedApplication = {
    ...application,
    status,
    reviewedAt: new Date().toISOString(),
    reviewedBy,
    reviewedByName,
    reviewNote: reviewNote?.trim() || null,
  };

  const where = application.applicationId.startsWith('legacy_')
    ? {
        type: RUNNER_APPLICATION_TYPE,
        data: { contains: `"applicantId":"${applicantId}"` },
      }
    : {
        type: RUNNER_APPLICATION_TYPE,
        data: { contains: `"applicationId":"${application.applicationId}"` },
      };

  await db.notification.updateMany({
    where,
    data: {
      title: buildRunnerApplicationTitle(reviewedApplication),
      message: buildRunnerApplicationMessage(reviewedApplication),
      data: serializeRunnerApplication(reviewedApplication),
      read: true,
    },
  });

  return reviewedApplication;
}

// GET /api/admin/stats — dashboard overview
export async function GET(req: NextRequest) {
  if (!isDatabaseAvailable()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    const adminResult = await requireAdminUser();
    if (!adminResult.ok) {
      return NextResponse.json({ error: adminResult.error }, { status: adminResult.status });
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
      db.task.count().catch(() => 0),
    ]);

    const recentUsers = await db.user.findMany({
      orderBy: { createdAt: 'desc' }, take: 10,
      select: { id: true, username: true, email: true, avatar: true, role: true, verificationStatus: true, trustScore: true, isRunner: true, createdAt: true },
    });

    const recentReports = await db.report.findMany({
      where: { status: 'pending' }, orderBy: { createdAt: 'desc' }, take: 10,
      include: { reporter: { select: { username: true } }, listing: { select: { title: true, id: true } } },
    });

    // Pagination for allUsers
    const page = Math.max(1, parseInt(new URL(req.url).searchParams.get('page') || '1'));
    const userPageSize = 50;
    const userSkip = (page - 1) * userPageSize;

    const [allUsers, totalUserCount] = await Promise.all([
      db.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: userPageSize,
        skip: userSkip,
        select: { id: true, username: true, email: true, avatar: true, role: true, verificationStatus: true, trustScore: true, ratingAverage: true, totalReviews: true, isRunner: true, phone: true, faculty: true, hostel: true, createdAt: true },
      }),
      db.user.count(),
    ]);

    const allListings = await db.listing.findMany({
      orderBy: { createdAt: 'desc' }, take: 50,
      include: { seller: { select: { username: true, id: true } } },
    });

    // Recent marketplace orders
    const recentOrders = await db.marketplaceOrder.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        buyer: { select: { id: true, username: true, avatar: true } },
        seller: { select: { id: true, username: true, avatar: true } },
        listing: { select: { id: true, title: true, price: true, images: true } },
      },
    }).catch(() => []);

    return NextResponse.json({
      stats: { totalUsers, totalListings, activeListings, soldListings, totalReviews, totalReports, pendingReports, totalChats, totalTasks },
      recentUsers, recentReports, allUsers, allListings, recentOrders,
      usersPage: page,
      usersTotal: totalUserCount,
      usersTotalPages: Math.ceil(totalUserCount / userPageSize),
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
    const adminResult = await requireAdminUser();
    if (!adminResult.ok) {
      return NextResponse.json({ error: adminResult.error }, { status: adminResult.status });
    }

    const adminUser = adminResult.user;

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
          data: {
            isRunner: true,
            trustScore: { increment: 10 },
            runnerAvailabilityStatus: 'offline',
          },
        });
        await db.runnerProfile.updateMany({
          where: { userId: targetId },
          data: {
            status: 'approved',
            reviewedAt: new Date(),
            reviewedBy: adminUser.id,
            reviewNote: data?.reviewNote?.trim() || null,
          },
        });
        await updateRunnerApplicationReviewStatus({
          applicantId: targetId,
          applicationId: data?.applicationId,
          status: 'approved',
          reviewedBy: adminUser.id,
          reviewedByName: adminUser.username,
          reviewNote: data?.reviewNote,
        });
        await notifyUser(targetId, {
          title: 'Runner Application Approved ✅',
          body: 'You are now an approved runner. Open Runner to start taking campus requests.',
          type: 'system',
          data: { url: '/?tab=tasks' },
        });
        return NextResponse.json({ success: true, message: 'Runner approved' });

      case 'reject_runner':
        await db.user.update({
          where: { id: targetId },
          data: { isRunner: false, runnerAvailabilityStatus: 'offline' },
        });
        await db.runnerProfile.updateMany({
          where: { userId: targetId },
          data: {
            status: 'rejected',
            reviewedAt: new Date(),
            reviewedBy: adminUser.id,
            reviewNote: data?.reviewNote?.trim() || null,
          },
        });
        await updateRunnerApplicationReviewStatus({
          applicantId: targetId,
          applicationId: data?.applicationId,
          status: 'rejected',
          reviewedBy: adminUser.id,
          reviewedByName: adminUser.username,
          reviewNote: data?.reviewNote,
        });
        await notifyUser(targetId, {
          title: 'Runner Application Update',
          body: 'Your runner application needs another review before approval. Update your details and apply again.',
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
