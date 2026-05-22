import { Task, TASK_CATEGORIES, URGENCY_LABELS, URGENCY_COLORS } from '@/lib/types';
import type { RunnerPricingGuide } from '@/lib/runner-pricing';

// ── Constants ──
export const RUNNER_STORAGE_KEY_PREFIX = 'unilag_runner_mode:';
export const APP_STEP_LABELS = ['About you', 'Runner profile', 'Verification'];
export const REQUEST_STEP_LABELS = ['What needs to move?', 'Route & timing', 'Budget & review'];
export const LIVE_REQUEST_WINDOW_MS = 1000 * 60 * 45;
export const LIVE_OFFER_WINDOW_MS = 1000 * 60 * 12;

export const TRANSPORT_OPTIONS = [
  { value: 'bicycle', label: 'Bicycle' },
  { value: 'motorbike', label: 'Motorbike' },
  { value: 'walking', label: 'On foot' },
  { value: 'scooter', label: 'Scooter' },
] as const;

export const CAMPUS_POINTS: CampusPoint[] = [
  { id: 'main-gate', label: 'Main Gate', lat: 6.5153, lng: 3.3901 },
  { id: 'jaja', label: 'Jaja Hall', lat: 6.5168, lng: 3.3965 },
  { id: 'moremi', label: 'Moremi Hall', lat: 6.521, lng: 3.3909 },
  { id: 'new-hall', label: 'New Hall', lat: 6.5202, lng: 3.3978 },
  { id: 'unilag-medical', label: 'Medical Centre', lat: 6.5185, lng: 3.3862 },
  { id: 'faculty-science', label: 'Faculty of Science', lat: 6.5137, lng: 3.3942 },
  { id: 'lagoon-front', label: 'Lagoon Front', lat: 6.5243, lng: 3.3837 },
  { id: 'library', label: 'University Library', lat: 6.5148, lng: 3.3885 },
];

// ── Types ──
export type RunnerEntryMode = 'intro' | 'customer' | 'runner_apply' | 'runner';
export type MarketplaceSortMode = 'live' | 'urgent' | 'best_budget' | 'highest_budget';
export type RequestBudgetTone = 'low' | 'fair' | 'premium';

export type CampusPoint = {
  id: string;
  label: string;
  lat: number;
  lng: number;
};

export type DisplayOffer = {
  id: string;
  runnerId: string;
  amount: number;
  message: string | null;
  status: string;
  createdAt: string;
  createdByRole?: string;
  runner: {
    id: string;
    username: string;
    avatar: string | null;
    runnerRating: number;
    tasksCompleted: number;
    trustScore?: number;
    verificationStatus?: string;
  };
};

// ── Utility functions ──
export function isFreshTimestamp(value?: string | null, freshnessWindowMs = LIVE_REQUEST_WINDOW_MS) {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return false;
  return Date.now() - timestamp <= freshnessWindowMs;
}

export function getUrgencyRank(urgency?: string | null) {
  return { urgent: 4, high: 3, medium: 2, low: 1 }[urgency || 'medium'] || 0;
}

export function getTaskBudgetGap(task: Task) {
  if (!task.pricingGuide) return Number.MAX_SAFE_INTEGER;
  return Math.abs(task.reward - task.pricingGuide.recommended);
}

export function sortMarketplaceTasks(tasks: Task[], mode: MarketplaceSortMode) {
  return [...tasks].sort((left, right) => {
    if (mode === 'urgent') {
      return getUrgencyRank(right.urgency) - getUrgencyRank(left.urgency)
        || new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    }
    if (mode === 'best_budget') {
      return getTaskBudgetGap(left) - getTaskBudgetGap(right)
        || new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    }
    if (mode === 'highest_budget') {
      return right.reward - left.reward
        || new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    }
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });
}

export function formatLiveSyncLabel(lastSyncedAt: Date | null) {
  if (!lastSyncedAt) return 'Waiting for first sync';
  const secondsAgo = Math.max(0, Math.round((Date.now() - lastSyncedAt.getTime()) / 1000));
  if (secondsAgo < 5) return 'Synced just now';
  if (secondsAgo < 60) return `Synced ${secondsAgo}s ago`;
  const minutesAgo = Math.round(secondsAgo / 60);
  return `Synced ${minutesAgo}m ago`;
}

export function getRunnerStorageKey(userId: string) {
  return `${RUNNER_STORAGE_KEY_PREFIX}${userId}`;
}

export async function compressImage(file: File) {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read image'));
    reader.readAsDataURL(file);
  });
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
  });
  const canvas = document.createElement('canvas');
  const maxEdge = 900;
  let width = image.width;
  let height = image.height;
  if (width > height && width > maxEdge) { height *= maxEdge / width; width = maxEdge; }
  else if (height >= width && height > maxEdge) { width *= maxEdge / height; height = maxEdge; }
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')?.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL('image/webp', 0.88);
}

export function parseTaskImages(images: string | null | undefined) {
  if (!images) return [] as string[];
  try {
    const parsed = JSON.parse(images);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string' && item.length > 0) : [];
  } catch { return []; }
}

export function getRouteSummary(pickupLocation?: string | null, dropoffLocation?: string | null) {
  if (pickupLocation && dropoffLocation) return `${pickupLocation} → ${dropoffLocation}`;
  return pickupLocation || dropoffLocation || 'Route details coming soon';
}

export function getTaskPickupLabel(task: Task) {
  return task.pickupLabel || task.pickupLocation || 'Pickup not pinned yet';
}

export function getTaskDropoffLabel(task: Task) {
  return task.dropoffLabel || task.location || 'Drop-off not pinned yet';
}

export function getTaskOfferCount(task: Task) {
  if (Array.isArray(task.offers) && task.offers.length > 0) {
    return task.offers.filter((offer) => offer.status === 'open' || offer.status === 'accepted').length;
  }
  return task._count?.applications || task.applications?.length || 0;
}

export function getCampusPoint(pointId: string | null) {
  return CAMPUS_POINTS.find((point) => point.id === pointId) || null;
}

export function getDisplayOffers(task: Task): DisplayOffer[] {
  if (task.offers && task.offers.length > 0) {
    const latestByRunner = new Map<string, DisplayOffer>();
    for (const offer of [...task.offers].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())) {
      if (!offer.runner || latestByRunner.has(offer.runnerId)) continue;
      latestByRunner.set(offer.runnerId, {
        id: offer.id, runnerId: offer.runnerId, amount: offer.amount,
        message: offer.message, status: offer.status, createdAt: offer.createdAt,
        createdByRole: offer.createdByRole,
        runner: {
          id: offer.runner.id, username: offer.runner.username, avatar: offer.runner.avatar,
          runnerRating: offer.runner.runnerRating, tasksCompleted: offer.runner.tasksCompleted,
          trustScore: offer.runner.trustScore, verificationStatus: offer.runner.verificationStatus,
        },
      });
    }
    return [...latestByRunner.values()].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
  return (task.applications || []).map((app) => ({
    id: app.id, runnerId: app.runnerId, amount: app.proposedPrice || task.reward,
    message: app.message, status: app.status, createdAt: app.createdAt,
    createdByRole: 'runner', runner: app.runner,
  }));
}

export function getBudgetTone(pricingGuide?: RunnerPricingGuide | null): RequestBudgetTone {
  if (!pricingGuide?.budgetPosition || pricingGuide.budgetPosition === 'fair') return 'fair';
  return pricingGuide.budgetPosition;
}

export function getBudgetToneCopy(pricingGuide?: RunnerPricingGuide | null) {
  const tone = getBudgetTone(pricingGuide);
  if (tone === 'low') return {
    label: 'Below guide',
    cardClass: 'border-amber-300/40 bg-amber-50/80 dark:bg-amber-900/10',
    badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300',
    description: 'Expect more counter-offers unless a runner is already moving on the same route.',
  };
  if (tone === 'premium') return {
    label: 'Premium budget',
    cardClass: 'border-emerald-300/40 bg-emerald-50/80 dark:bg-emerald-900/10',
    badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300',
    description: 'You are paying above the current guide, which can pull faster responses.',
  };
  return {
    label: 'Fair budget',
    cardClass: 'border-primary/20 bg-primary/5',
    badgeClass: 'bg-primary/10 text-primary',
    description: 'This sits in the current guide range and should feel balanced to most runners.',
  };
}

export function sortOfferApplications(task: Task, applications: Task['applications'] = []) {
  return [...applications].sort((left, right) => {
    const leftAccepted = left.status === 'accepted' ? 1 : 0;
    const rightAccepted = right.status === 'accepted' ? 1 : 0;
    if (leftAccepted !== rightAccepted) return rightAccepted - leftAccepted;
    const leftPending = left.status === 'pending' ? 1 : 0;
    const rightPending = right.status === 'pending' ? 1 : 0;
    if (leftPending !== rightPending) return rightPending - leftPending;
    const leftPrice = left.proposedPrice || task.reward;
    const rightPrice = right.proposedPrice || task.reward;
    const leftDelta = Math.abs(leftPrice - task.reward);
    const rightDelta = Math.abs(rightPrice - task.reward);
    if (leftDelta !== rightDelta) return leftDelta - rightDelta;
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });
}
