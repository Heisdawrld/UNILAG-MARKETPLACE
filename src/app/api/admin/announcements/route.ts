import { NextRequest, NextResponse } from 'next/server'
import { db, isDatabaseAvailable } from '@/lib/db'
import { requireAdminUser } from '@/lib/admin-auth'
import { notifyUser } from '@/lib/push'

// POST /api/admin/announcements — Send system-wide announcement
export async function POST(req: NextRequest) {
  if (!isDatabaseAvailable()) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
  }

  try {
    const adminResult = await requireAdminUser()
    if (!adminResult.ok) {
      return NextResponse.json({ error: adminResult.error }, { status: adminResult.status })
    }

    const body = await req.json()
    const { title, message, type = 'system' } = body

    if (!title || !message) {
      return NextResponse.json({ error: 'title and message are required' }, { status: 400 })
    }

    const sanitizedTitle = String(title).trim().slice(0, 200)
    const sanitizedMessage = String(message).trim().slice(0, 1000)
    const sanitizedType = String(type).trim().slice(0, 50)

    // Get all user IDs
    const users = await db.user.findMany({
      select: { id: true },
      where: { role: { not: 'banned' } },
    })

    if (users.length === 0) {
      return NextResponse.json({ error: 'No active users found' }, { status: 404 })
    }

    // Batch create notifications for all users
    const notifications = await db.notification.createMany({
      data: users.map(u => ({
        userId: u.id,
        type: sanitizedType,
        title: sanitizedTitle,
        message: sanitizedMessage,
        data: JSON.stringify({ announcement: true, sentBy: adminResult.user.id }),
      })),
    })

    // Send push notifications in batches (non-blocking)
    const pushPromises = users.slice(0, 100).map(u =>
      notifyUser(u.id, {
        title: sanitizedTitle,
        body: sanitizedMessage.slice(0, 100),
        type: sanitizedType,
        tag: `announcement-${Date.now()}`,
      }).catch(() => {})
    )
    Promise.all(pushPromises).catch(() => {})

    return NextResponse.json({
      success: true,
      notificationsCreated: notifications.count,
      totalUsers: users.length,
    })
  } catch (error) {
    console.error('[admin announcements] Create error:', error)
    return NextResponse.json({ error: 'Failed to send announcement' }, { status: 500 })
  }
}
