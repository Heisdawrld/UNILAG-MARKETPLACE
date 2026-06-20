// ── Feature Flags ──
// Controls which features are active in the current version.
// Toggle these to enable/disable features without removing code.

export const FEATURES = {
  // V1 Core — always on
  MARKETPLACE: true,
  CHAT: true,
  SELLER_VERIFICATION: true,
  ESCROW_PAYMENT: true,
  BOOST_SYSTEM: true,
  WISHLIST: true,
  PWA: true,
  PUSH_NOTIFICATIONS: true,

  // V2 Features — disabled for V1 launch
  DELIVERY_SYSTEM: false,    // Runner/delivery system (socket.io + real-time tracking)
  RUNNER_NETWORK: false,     // Runner onboarding, dashboard, earnings
  LIVE_TRACKING: false,      // GPS tracking on map
  RUNNER_WALLET: false,      // Runner wallet, payouts, withdrawal
  FOOD_DELIVERY: false,      // Food-specific delivery flow
  SERVICE_MARKETPLACE: false, // Service listings (tutoring, etc.)
  TRUST_SCORE: false,        // Automated trust score calculation
  SPONSORED_ADS: false,      // Banner ads, category ads
  VOICE_MESSAGES: false,     // Voice notes in chat
  LOCATION_SHARING: false,   // Share location in chat
} as const;

export type FeatureName = keyof typeof FEATURES;

export function isFeatureEnabled(feature: FeatureName): boolean {
  return FEATURES[feature] ?? false;
}
