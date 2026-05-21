import { db } from '@/lib/db';

export const FULL_USER_SELECT = {
  id: true,
  username: true,
  email: true,
  avatar: true,
  faculty: true,
  department: true,
  level: true,
  bio: true,
  phone: true,
  whatsapp: true,
  hostel: true,
  verificationStatus: true,
  trustScore: true,
  ratingAverage: true,
  totalReviews: true,
  role: true,
  isRunner: true,
  runnerRating: true,
  tasksCompleted: true,
  runnerAvailabilityStatus: true,
  runnerLastActiveAt: true,
  runnerCurrentLat: true,
  runnerCurrentLng: true,
  runnerLocationUpdatedAt: true,
  clerkId: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const LEGACY_USER_SELECT = {
  id: true,
  username: true,
  email: true,
  avatar: true,
  faculty: true,
  department: true,
  level: true,
  bio: true,
  phone: true,
  whatsapp: true,
  hostel: true,
  verificationStatus: true,
  trustScore: true,
  ratingAverage: true,
  totalReviews: true,
  role: true,
  isRunner: true,
  runnerRating: true,
  tasksCompleted: true,
  clerkId: true,
  createdAt: true,
  updatedAt: true,
} as const;

type UserProfileRecord = {
  id: string;
  username: string;
  email: string;
  avatar: string | null;
  faculty: string | null;
  department: string | null;
  level: string | null;
  bio: string | null;
  phone: string | null;
  whatsapp: string | null;
  hostel: string | null;
  verificationStatus: string;
  trustScore: number;
  ratingAverage: number;
  totalReviews: number;
  role: string;
  isRunner: boolean;
  runnerRating: number;
  tasksCompleted: number;
  runnerAvailabilityStatus?: string | null;
  runnerLastActiveAt?: Date | null;
  runnerCurrentLat?: number | null;
  runnerCurrentLng?: number | null;
  runnerLocationUpdatedAt?: Date | null;
  clerkId?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function normalizeUserProfile(user: UserProfileRecord | null) {
  if (!user) return null;

  return {
    ...user,
    runnerAvailabilityStatus: user.runnerAvailabilityStatus ?? 'offline',
    runnerLastActiveAt: user.runnerLastActiveAt ?? null,
    runnerCurrentLat: user.runnerCurrentLat ?? null,
    runnerCurrentLng: user.runnerCurrentLng ?? null,
    runnerLocationUpdatedAt: user.runnerLocationUpdatedAt ?? null,
  };
}

async function findUserByIdWithFallback(id: string) {
  try {
    const user = await db.user.findUnique({
      where: { id },
      select: FULL_USER_SELECT,
    });
    return normalizeUserProfile(user as UserProfileRecord | null);
  } catch (error) {
    console.warn('[user-profile] Falling back to legacy user select', error);
    const user = await db.user.findUnique({
      where: { id },
      select: LEGACY_USER_SELECT,
    });
    return normalizeUserProfile(user as UserProfileRecord | null);
  }
}

async function findUserByEmailWithFallback(email: string) {
  try {
    const user = await db.user.findUnique({
      where: { email },
      select: FULL_USER_SELECT,
    });
    return normalizeUserProfile(user as UserProfileRecord | null);
  } catch (error) {
    console.warn('[user-profile] Falling back to legacy user select', error);
    const user = await db.user.findUnique({
      where: { email },
      select: LEGACY_USER_SELECT,
    });
    return normalizeUserProfile(user as UserProfileRecord | null);
  }
}

async function findUserByClerkIdWithFallback(clerkId: string) {
  try {
    const user = await db.user.findUnique({
      where: { clerkId },
      select: FULL_USER_SELECT,
    });
    return normalizeUserProfile(user as UserProfileRecord | null);
  } catch (error) {
    console.warn('[user-profile] Falling back to legacy user select', error);
    const user = await db.user.findUnique({
      where: { clerkId },
      select: LEGACY_USER_SELECT,
    });
    return normalizeUserProfile(user as UserProfileRecord | null);
  }
}

export async function findUserProfileByEmail(email: string) {
  return findUserByEmailWithFallback(email);
}

export async function findUserProfileByClerkId(clerkId: string) {
  return findUserByClerkIdWithFallback(clerkId);
}

export async function findUserProfileById(id: string) {
  return findUserByIdWithFallback(id);
}
