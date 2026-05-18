import { db, isDatabaseAvailable } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

const MAX_SELFIE_LENGTH = 2_500_000;

function parseApplicationPayload(raw: string | null) {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  if (!isDatabaseAvailable()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const authUser = await db.user.findUnique({
      where: { clerkId },
      select: {
        id: true,
        username: true,
        email: true,
        phone: true,
        faculty: true,
        hostel: true,
        role: true,
        isRunner: true,
      },
    });

    if (!authUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (authUser.role === 'banned') {
      return NextResponse.json({ error: 'Banned users cannot apply to become runners' }, { status: 403 });
    }

    if (authUser.isRunner) {
      return NextResponse.json({ error: 'You are already an approved runner' }, { status: 400 });
    }

    const body = await request.json();
    const {
      userId,
      studentId,
      motivation,
      availability,
      emergencyContact,
      selfie,
    } = body;

    if (!userId || !studentId || !emergencyContact || !selfie) {
      return NextResponse.json(
        { error: 'userId, studentId, emergencyContact, and selfie are required' },
        { status: 400 }
      );
    }

    if (userId !== authUser.id) {
      return NextResponse.json({ error: 'Forbidden — you can only apply for yourself' }, { status: 403 });
    }

    if (typeof selfie !== 'string' || !selfie.startsWith('data:image/') || selfie.length > MAX_SELFIE_LENGTH) {
      return NextResponse.json({ error: 'Please upload a valid image under 2MB' }, { status: 400 });
    }

    const admins = await db.user.findMany({
      where: { role: 'admin' },
      select: { id: true },
    });

    if (admins.length === 0) {
      return NextResponse.json({ error: 'No admin is available to review runner applications yet' }, { status: 503 });
    }

    const existingApplication = await db.notification.findFirst({
      where: {
        type: 'runner_application',
        OR: [
          { data: { contains: `"applicantId":"${authUser.id}"` } },
          { message: { contains: `"applicantId":"${authUser.id}"` } },
        ],
      },
    });

    if (existingApplication) {
      return NextResponse.json({ error: 'You already have a runner application under review' }, { status: 409 });
    }

    const applicationData = {
      applicantId: authUser.id,
      username: authUser.username,
      email: authUser.email,
      phone: authUser.phone || '',
      faculty: authUser.faculty || '',
      hostel: authUser.hostel || '',
      studentId: String(studentId).trim(),
      motivation: typeof motivation === 'string' ? motivation.trim() : '',
      availability: typeof availability === 'string' ? availability.trim() : '',
      emergencyContact: String(emergencyContact).trim(),
      selfie,
    };

    await Promise.all(
      admins.map((admin) =>
        db.notification.create({
          data: {
            userId: admin.id,
            type: 'runner_application',
            title: `Runner Application: ${authUser.username}`,
            message: `${authUser.username} applied to become a runner`,
            data: JSON.stringify(applicationData),
            read: false,
          },
        })
      )
    );

    return NextResponse.json({ success: true, message: 'Application submitted successfully' });
  } catch (error) {
    console.error('Runner application error:', error);
    return NextResponse.json({ error: 'Failed to submit application' }, { status: 500 });
  }
}

export async function GET() {
  if (!isDatabaseAvailable()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
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

    return NextResponse.json(
      applications.map((application) => ({
        ...application,
        data: parseApplicationPayload(application.data) || parseApplicationPayload(application.message),
      }))
    );
  } catch (error) {
    console.error('Runner application fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch applications' }, { status: 500 });
  }
}
