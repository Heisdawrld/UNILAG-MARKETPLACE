import type { RunnerApplication, RunnerApplicationStatus } from './types';

export const RUNNER_APPLICATION_TYPE = 'runner_application';

type NotificationLike = {
  id: string;
  title: string;
  message: string;
  data: string | null;
  createdAt: Date | string;
};

const RUNNER_STATUSES: RunnerApplicationStatus[] = ['pending', 'approved', 'rejected'];

function isRunnerApplicationStatus(value: unknown): value is RunnerApplicationStatus {
  return typeof value === 'string' && RUNNER_STATUSES.includes(value as RunnerApplicationStatus);
}

function asTrimmedString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function asNullableString(value: unknown) {
  const normalized = asTrimmedString(value);
  return normalized.length > 0 ? normalized : null;
}

export function buildRunnerApplicationId() {
  return `runner_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function buildRunnerApplicationTitle(application: RunnerApplication) {
  const prefix = application.status === 'pending'
    ? 'Runner Application'
    : application.status === 'approved'
      ? 'Runner Approved'
      : 'Runner Rejected';

  return `${prefix}: ${application.username}`;
}

export function buildRunnerApplicationMessage(application: RunnerApplication) {
  if (application.status === 'approved') {
    return `${application.username} was approved as a runner`;
  }

  if (application.status === 'rejected') {
    return `${application.username}'s runner application was rejected`;
  }

  return `${application.username} applied to become a runner`;
}

export function serializeRunnerApplication(application: RunnerApplication) {
  return JSON.stringify(application);
}

export function parseRunnerApplication(raw: string | null, notification?: NotificationLike): RunnerApplication | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    const applicantId = asTrimmedString((parsed as Record<string, unknown>).applicantId);
    if (!applicantId) return null;

    const submittedAt = asTrimmedString((parsed as Record<string, unknown>).submittedAt)
      || (notification ? new Date(notification.createdAt).toISOString() : new Date().toISOString());

    const profilePhoto = asTrimmedString((parsed as Record<string, unknown>).profilePhoto)
      || asTrimmedString((parsed as Record<string, unknown>).selfie);
    const studentIdImage = asTrimmedString((parsed as Record<string, unknown>).studentIdImage)
      || asTrimmedString((parsed as Record<string, unknown>).selfie);

    return {
      applicationId: asTrimmedString((parsed as Record<string, unknown>).applicationId)
        || `legacy_${applicantId}_${submittedAt}`,
      applicantId,
      username: asTrimmedString((parsed as Record<string, unknown>).username) || 'Runner applicant',
      email: asTrimmedString((parsed as Record<string, unknown>).email),
      phone: asTrimmedString((parsed as Record<string, unknown>).phone),
      whatsapp: asTrimmedString((parsed as Record<string, unknown>).whatsapp),
      faculty: asTrimmedString((parsed as Record<string, unknown>).faculty),
      hostel: asTrimmedString((parsed as Record<string, unknown>).hostel),
      studentId: asTrimmedString((parsed as Record<string, unknown>).studentId),
      transportMode: asTrimmedString((parsed as Record<string, unknown>).transportMode) || 'walking',
      availability: asTrimmedString((parsed as Record<string, unknown>).availability),
      preferredZone: asTrimmedString((parsed as Record<string, unknown>).preferredZone),
      deliveryExperience: asTrimmedString((parsed as Record<string, unknown>).deliveryExperience),
      motivation: asTrimmedString((parsed as Record<string, unknown>).motivation),
      emergencyContactName: asTrimmedString((parsed as Record<string, unknown>).emergencyContactName),
      emergencyContactPhone: asTrimmedString((parsed as Record<string, unknown>).emergencyContactPhone)
        || asTrimmedString((parsed as Record<string, unknown>).emergencyContact),
      emergencyContactRelationship: asTrimmedString((parsed as Record<string, unknown>).emergencyContactRelationship),
      profilePhoto,
      studentIdImage,
      status: isRunnerApplicationStatus((parsed as Record<string, unknown>).status)
        ? (parsed as Record<string, RunnerApplicationStatus>).status
        : 'pending',
      submittedAt,
      reviewedAt: asNullableString((parsed as Record<string, unknown>).reviewedAt),
      reviewedBy: asNullableString((parsed as Record<string, unknown>).reviewedBy),
      reviewedByName: asNullableString((parsed as Record<string, unknown>).reviewedByName),
      reviewNote: asNullableString((parsed as Record<string, unknown>).reviewNote),
    };
  } catch {
    return null;
  }
}

export function groupRunnerApplications(notifications: NotificationLike[]) {
  const grouped = new Map<string, RunnerApplication>();

  for (const notification of notifications) {
    const parsed = parseRunnerApplication(notification.data, notification);
    if (!parsed) continue;

    const existing = grouped.get(parsed.applicationId);
    if (!existing || new Date(parsed.submittedAt).getTime() > new Date(existing.submittedAt).getTime()) {
      grouped.set(parsed.applicationId, parsed);
    }
  }

  return Array.from(grouped.values()).sort((a, b) => {
    return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
  });
}

export function getLatestRunnerApplicationForApplicant(applications: RunnerApplication[], applicantId: string) {
  return applications
    .filter((application) => application.applicantId === applicantId)
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())[0] || null;
}
