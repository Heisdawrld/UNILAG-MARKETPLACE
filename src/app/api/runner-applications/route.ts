import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { db, isDatabaseAvailable } from '@/lib/db';
import { requireAdminUser } from '@/lib/admin-auth';
import {
  RUNNER_APPLICATION_TYPE,
  buildRunnerApplicationId,
  buildRunnerApplicationMessage,
  buildRunnerApplicationTitle,
  getLatestRunnerApplicationForApplicant,
  groupRunnerApplications,
  serializeRunnerApplication,
} from '@/lib/runner-applications';
import type { RunnerApplication } from '@/lib/types';

const MAX_IMAGE_LENGTH = 2_500_000;

async function getAuthenticatedUser() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return null;

  return db.user.findUnique({
    where: { clerkId },
    select: {
      id: true,
      username: true,
      email: true,
      phone: true,
      whatsapp: true,
      faculty: true,
      hostel: true,
      role: true,
      isRunner: true,
    },
  });
}

async function getApplicationNotifications(applicantId?: string) {
  return db.notification.findMany({
    where: {
      type: RUNNER_APPLICATION_TYPE,
      ...(applicantId
        ? {
            data: {
              contains: `"applicantId":"${applicantId}"`,
            },
          }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
  });
}

function isValidImage(value: unknown) {
  return typeof value === 'string'
    && value.startsWith('data:image/')
    && value.length <= MAX_IMAGE_LENGTH;
}

export async function POST(request: NextRequest) {
  if (!isDatabaseAvailable()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    const authUser = await getAuthenticatedUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
      transportMode,
      availability,
      preferredZone,
      deliveryExperience,
      motivation,
      emergencyContactName,
      emergencyContactPhone,
      emergencyContactRelationship,
      profilePhoto,
      studentIdImage,
      phone,
      whatsapp,
      faculty,
      hostel,
    } = body;

    if (userId !== authUser.id) {
      return NextResponse.json({ error: 'Forbidden — you can only apply for yourself' }, { status: 403 });
    }

    if (!studentId || !transportMode || !availability || !emergencyContactName || !emergencyContactPhone || !profilePhoto || !studentIdImage) {
      return NextResponse.json({ error: 'Please complete all required runner application fields' }, { status: 400 });
    }

    if (!isValidImage(profilePhoto) || !isValidImage(studentIdImage)) {
      return NextResponse.json({ error: 'Please upload valid images under 2MB each' }, { status: 400 });
    }

    const existingApplications = groupRunnerApplications(await getApplicationNotifications(authUser.id));
    const latestApplication = getLatestRunnerApplicationForApplicant(existingApplications, authUser.id);

    if (latestApplication?.status === 'pending') {
      return NextResponse.json({ error: 'You already have a runner application under review' }, { status: 409 });
    }

    if (latestApplication?.status === 'approved') {
      return NextResponse.json({ error: 'You are already approved as a runner' }, { status: 400 });
    }

    const admins = await db.user.findMany({ where: { role: 'admin' }, select: { id: true } });
    if (admins.length === 0) {
      return NextResponse.json({ error: 'No admin is available to review runner applications yet' }, { status: 503 });
    }

    const submittedAt = new Date().toISOString();
    const application: RunnerApplication = {
      applicationId: buildRunnerApplicationId(),
      applicantId: authUser.id,
      username: authUser.username,
      email: authUser.email,
      phone: typeof phone === 'string' ? phone.trim() : authUser.phone || '',
      whatsapp: typeof whatsapp === 'string' ? whatsapp.trim() : authUser.whatsapp || '',
      faculty: typeof faculty === 'string' ? faculty.trim() : authUser.faculty || '',
      hostel: typeof hostel === 'string' ? hostel.trim() : authUser.hostel || '',
      studentId: String(studentId).trim(),
      transportMode: String(transportMode).trim(),
      availability: String(availability).trim(),
      preferredZone: typeof preferredZone === 'string' ? preferredZone.trim() : '',
      deliveryExperience: typeof deliveryExperience === 'string' ? deliveryExperience.trim() : '',
      motivation: typeof motivation === 'string' ? motivation.trim() : '',
      emergencyContactName: String(emergencyContactName).trim(),
      emergencyContactPhone: String(emergencyContactPhone).trim(),
      emergencyContactRelationship: typeof emergencyContactRelationship === 'string' ? emergencyContactRelationship.trim() : '',
      profilePhoto,
      studentIdImage,
      status: 'pending',
      submittedAt,
      reviewedAt: null,
      reviewedBy: null,
      reviewedByName: null,
      reviewNote: null,
    };

    await db.user.update({
      where: { id: authUser.id },
      data: {
        phone: application.phone || null,
        whatsapp: application.whatsapp || null,
        faculty: application.faculty || null,
        hostel: application.hostel || null,
      },
    }).catch(() => null);

    const data = serializeRunnerApplication(application);

    await Promise.all(
      admins.map((admin) =>
        db.notification.create({
          data: {
            userId: admin.id,
            type: RUNNER_APPLICATION_TYPE,
            title: buildRunnerApplicationTitle(application),
            message: buildRunnerApplicationMessage(application),
            data,
            read: false,
          },
        }),
      ),
    );

    await db.notification.create({
      data: {
        userId: authUser.id,
        type: 'system',
        title: 'Runner application received',
        message: 'Your runner application is under review. We will notify you once an admin makes a decision.',
        data: JSON.stringify({ url: '/?tab=tasks' }),
      },
    }).catch(() => null);

    return NextResponse.json({ success: true, application });
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
    const { searchParams } = new URL(request.url);
    const scope = searchParams.get('scope');

    const authUser = await getAuthenticatedUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (scope === 'self') {
      const applications = groupRunnerApplications(await getApplicationNotifications(authUser.id));
      return NextResponse.json({
        currentApplication: getLatestRunnerApplicationForApplicant(applications, authUser.id),
        applications,
      });
    }

    const adminResult = await requireAdminUser();
    if (!adminResult.ok) {
      return NextResponse.json({ error: adminResult.error }, { status: adminResult.status });
    }

    return NextResponse.json(groupRunnerApplications(await getApplicationNotifications()));
  } catch (error) {
    console.error('Runner application fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch runner applications' }, { status: 500 });
  }
}
