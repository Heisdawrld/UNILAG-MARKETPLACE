import { db, isDatabaseAvailable } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

// Store runner applications in notifications table as a workaround
// (avoids adding new DB table — notifications has all needed fields)
export async function POST(request: NextRequest) {
  if (!isDatabaseAvailable()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    // ── SECURITY: verify Clerk session ──
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const authUser = await db.user.findUnique({ where: { clerkId } });
    if (!authUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { userId, studentId, motivation, availability } = body;

    if (!userId || !studentId) {
      return NextResponse.json({ error: 'userId and studentId are required' }, { status: 400 });
    }

    // ── SECURITY: ensure requesting user is applying for themselves ──
    if (userId !== authUser.id) {
      return NextResponse.json({ error: 'Forbidden — you can only apply for yourself' }, { status: 403 });
    }

    // Check user exists
    const user = authUser;

    // Store application as a notification to admin users
    // Message format is parseable by admin dashboard
    const admins = await db.user.findMany({ where: { role: 'admin' } });

    if (admins.length > 0) {
      await Promise.all(admins.map(admin =>
        db.notification.create({
          data: {
            userId: admin.id,
            type: 'runner_application',
            title: `Runner Application: ${user.username}`,
            message: JSON.stringify({ applicantId: userId, studentId, motivation, availability, username: user.username }),
            read: false,
          },
        })
      ));
    }

    return NextResponse.json({ success: true, message: 'Application submitted successfully' });
  } catch (error) {
    console.error('Runner application error:', error);
    return NextResponse.json({ error: 'Failed to submit application' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
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

    const applications = await db.notification.findMany({
      where: { userId: admin.id, type: 'runner_application' },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(applications.map(a => {
      try {
        return { ...a, data: JSON.parse(a.message) };
      } catch { return a; }
    }));
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch applications' }, { status: 500 });
  }
}
