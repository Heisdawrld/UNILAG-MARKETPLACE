type RunnerPricingInput = {
  category?: string | null;
  urgency?: string | null;
  pickupLocation?: string | null;
  dropoffLocation?: string | null;
  deadline?: string | Date | null;
  reward?: number | null;
};

export type RunnerPricePosition = 'low' | 'fair' | 'premium';

export interface RunnerPricingGuide {
  suggestedMin: number;
  suggestedMax: number;
  recommended: number;
  urgencyFee: number;
  routeFee: number;
  timingFee: number;
  routeLabel: string;
  confidenceLabel: string;
  budgetPosition: RunnerPricePosition | null;
}

const CATEGORY_BASELINES: Record<string, { min: number; max: number }> = {
  Delivery: { min: 900, max: 1500 },
  'Food Pickup': { min: 800, max: 1400 },
  Printing: { min: 600, max: 1100 },
  Tutoring: { min: 1800, max: 3500 },
  Shopping: { min: 1000, max: 1800 },
  'Queue Holding': { min: 1200, max: 2200 },
  Cleaning: { min: 1500, max: 2800 },
  'Moving Help': { min: 1800, max: 3200 },
  Miscellaneous: { min: 900, max: 1700 },
};

const URGENCY_SURCHARGE: Record<string, number> = {
  low: 0,
  medium: 100,
  high: 350,
  urgent: 700,
};

const CAMPUS_ZONES = [
  {
    name: 'residential halls',
    keywords: ['jaja', 'moremi', 'makama', 'ely', 'sodeinde', 'eni-njoku', 'honours', 'kofo', 'hall'],
  },
  {
    name: 'academic core',
    keywords: ['senate', 'library', 'engineering', 'education', 'science', 'arts', 'law', 'mass comm', 'faculty'],
  },
  {
    name: 'commercial zone',
    keywords: ['new hall', 'shopping complex', 'commercial', 'lagmobile', 'canteen', 'jaja shopping', 'mall'],
  },
  {
    name: 'campus edge',
    keywords: ['gate', 'unilag gate', '2nd gate', 'lagos road', 'akoka', 'yaba', 'bariga'],
  },
];

function cleanText(value?: string | null) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function roundToNearest50(value: number) {
  return Math.max(300, Math.round(value / 50) * 50);
}

function detectZone(value?: string | null) {
  const text = cleanText(value);
  if (!text) return null;

  for (const zone of CAMPUS_ZONES) {
    if (zone.keywords.some((keyword) => text.includes(keyword))) {
      return zone.name;
    }
  }

  return null;
}

function buildRouteAdjustment(pickupLocation?: string | null, dropoffLocation?: string | null) {
  const pickup = cleanText(pickupLocation);
  const dropoff = cleanText(dropoffLocation);
  const pickupZone = detectZone(pickupLocation);
  const dropoffZone = detectZone(dropoffLocation);

  if (!pickup && !dropoff) {
    return { fee: 0, label: 'Route not set yet', confidence: 'Baseline estimate' };
  }

  if (pickup && dropoff && pickup === dropoff) {
    return { fee: 0, label: 'Same-point handoff', confidence: 'Precise route estimate' };
  }

  if (pickupZone && dropoffZone) {
    if (pickupZone === dropoffZone) {
      return { fee: 150, label: `${pickupZone} handoff`, confidence: 'Route-adjusted estimate' };
    }

    if (pickupZone === 'campus edge' || dropoffZone === 'campus edge') {
      return { fee: 500, label: 'Campus-edge route', confidence: 'Route-adjusted estimate' };
    }

    return { fee: 300, label: `${pickupZone} → ${dropoffZone}`, confidence: 'Route-adjusted estimate' };
  }

  if (pickup && dropoff) {
    return { fee: 250, label: 'Cross-campus route', confidence: 'Route-adjusted estimate' };
  }

  return { fee: 100, label: 'Single-point meetup', confidence: 'Baseline estimate' };
}

function buildTimingAdjustment(deadline?: string | Date | null) {
  if (!deadline) {
    return { fee: 0, confidence: null };
  }

  const parsed = new Date(deadline);
  if (Number.isNaN(parsed.getTime())) {
    return { fee: 0, confidence: null };
  }

  const hoursUntilDeadline = (parsed.getTime() - Date.now()) / (1000 * 60 * 60);

  if (hoursUntilDeadline <= 0) {
    return { fee: 250, confidence: 'Time-sensitive estimate' };
  }

  if (hoursUntilDeadline <= 1.5) {
    return { fee: 450, confidence: 'Time-sensitive estimate' };
  }

  if (hoursUntilDeadline <= 4) {
    return { fee: 200, confidence: 'Time-sensitive estimate' };
  }

  return { fee: 0, confidence: null };
}

export function getRunnerPricingGuide({
  category,
  urgency,
  pickupLocation,
  dropoffLocation,
  deadline,
  reward,
}: RunnerPricingInput): RunnerPricingGuide {
  const baseline = CATEGORY_BASELINES[category || ''] || CATEGORY_BASELINES.Miscellaneous;
  const urgencyFee = URGENCY_SURCHARGE[urgency || 'medium'] ?? URGENCY_SURCHARGE.medium;
  const route = buildRouteAdjustment(pickupLocation, dropoffLocation);
  const timing = buildTimingAdjustment(deadline);

  const suggestedMin = roundToNearest50(baseline.min + Math.round(route.fee * 0.7) + urgencyFee + Math.round(timing.fee * 0.5));
  const suggestedMax = roundToNearest50(baseline.max + route.fee + urgencyFee + timing.fee);
  const recommended = roundToNearest50((suggestedMin + suggestedMax) / 2);

  let budgetPosition: RunnerPricePosition | null = null;
  if (typeof reward === 'number' && Number.isFinite(reward) && reward > 0) {
    if (reward < suggestedMin) {
      budgetPosition = 'low';
    } else if (reward > suggestedMax) {
      budgetPosition = 'premium';
    } else {
      budgetPosition = 'fair';
    }
  }

  return {
    suggestedMin,
    suggestedMax,
    recommended,
    urgencyFee,
    routeFee: route.fee,
    timingFee: timing.fee,
    routeLabel: route.label,
    confidenceLabel: timing.confidence || route.confidence,
    budgetPosition,
  };
}

export function attachRunnerPricingGuide<T extends {
  category?: string | null;
  urgency?: string | null;
  pickupLocation?: string | null;
  location?: string | null;
  deadline?: string | Date | null;
  reward?: number | null;
}>(task: T) {
  return {
    ...task,
    pricingGuide: getRunnerPricingGuide({
      category: task.category,
      urgency: task.urgency,
      pickupLocation: task.pickupLocation,
      dropoffLocation: task.location,
      deadline: task.deadline,
      reward: task.reward ?? null,
    }),
  };
}
