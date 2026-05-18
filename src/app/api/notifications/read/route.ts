import { db, isDatabaseAvailable } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(request: NextRequest) {
  if (!isDatabaseAvailable()) {
    return NextResponse.json(
      { error: 'Database not configured. Please set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN environment variables.' },
      { status: 503 }
    );
  }
  try {
    const body = await request.json();
    const { userId, notificationIds, markAll, chatId, taskId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    if (markAll) {
      // Mark all notifications as read for this user
      await db.notification.updateMany({
        where: {
          userId,
          read: false,
          type: { not: 'runner_application' },
        },
        data: { read: true },
      });

      return NextResponse.json({ success: true, message: 'All notifications marked as read' });
    }

    if (chatId) {
      await db.notification.updateMany({
        where: {
          userId,
          read: false,
          type: 'new_message',
          data: { contains: `"chatId":"${chatId}"` },
        },
        data: { read: true },
      });

      return NextResponse.json({ success: true, message: 'Chat notifications marked as read' });
    }

    if (taskId) {
      await db.notification.updateMany({
        where: {
          userId,
          read: false,
          type: { not: 'runner_application' },
          data: { contains: `"taskId":"${taskId}"` },
        },
        data: { read: true },
      });

      return NextResponse.json({ success: true, message: 'Task notifications marked as read' });
    }

    // Mark specific notifications as read
    if (!notificationIds || !Array.isArray(notificationIds) || notificationIds.length === 0) {
      return NextResponse.json(
        { error: 'notificationIds array, chatId, or taskId is required when not marking all' },
        { status: 400 }
      );
    }

    await db.notification.updateMany({
      where: {
        id: { in: notificationIds },
        userId,
        type: { not: 'runner_application' },
      },
      data: { read: true },
    });

    return NextResponse.json({ success: true, message: 'Notifications marked as read' });
  } catch (error) {
    console.error('Error marking notifications as read:', error);
    return NextResponse.json(
      { error: 'Failed to mark notifications as read' },
      { status: 500 }
    );
  }
}
