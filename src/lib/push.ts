// Server-side push notification sender
// Uses dynamic import to avoid issues when web-push native deps aren't available
import { db, isDatabaseAvailable } from './db';

export interface PushPayload {
  title: string;
  body: string;
  type?: string;
  tag?: string;
  data?: Record<string, unknown>;
  requireInteraction?: boolean;
}

// Extended payload for delivery-specific notifications (backward compat)
interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  url?: string;
  type?: string;
  data?: Record<string, string>;
}

// Lazily load web-push to avoid module-level crashes
let webpushConfigured = false;
let webpushModule: any = null;

async function getWebPush() {
  if (webpushModule) return webpushModule;
  try {
    webpushModule = await import('web-push');
    const wp = webpushModule.default || webpushModule;
    const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
    const priv = process.env.VAPID_PRIVATE_KEY || '';
    if (pub && priv && !webpushConfigured) {
      wp.setVapidDetails('mailto:admin@unilagmarketplace.com', pub, priv);
      webpushConfigured = true;
    }
    return wp;
  } catch {
    return null;
  }
}

// ── Core push functions ──

// Send push notification to a specific user
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  if (!isDatabaseAvailable()) return 0;

  const wp = await getWebPush();
  if (!wp) return 0;

  try {
    const subscriptions = await db.pushSubscription.findMany({
      where: { userId },
    });

    let sent = 0;
    for (const sub of subscriptions) {
      try {
        const keys = JSON.parse(sub.keys);
        await wp.sendNotification(
          { endpoint: sub.endpoint, keys },
          JSON.stringify({
            ...payload,
            data: { ...payload.data, type: payload.type },
          })
        );
        sent++;
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 410 || statusCode === 404) {
          await db.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        }
      }
    }
    return sent;
  } catch {
    return 0;
  }
}

// Send push to multiple users
export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<number> {
  let totalSent = 0;
  for (const userId of userIds) {
    totalSent += await sendPushToUser(userId, payload);
  }
  return totalSent;
}

// Convenience: Send push + create in-app notification
export async function notifyUser(userId: string, payload: PushPayload & { message?: string }): Promise<void> {
  if (!isDatabaseAvailable()) return;

  try {
    await db.notification.create({
      data: {
        userId,
        type: payload.type || 'system',
        title: payload.title,
        message: payload.body || payload.message || '',
        data: payload.data ? JSON.stringify(payload.data) : null,
      },
    });
  } catch {}

  await sendPushToUser(userId, payload);
}

export async function notifyUsers(userIds: string[], payload: PushPayload & { message?: string }): Promise<void> {
  if (!isDatabaseAvailable() || userIds.length === 0) return;

  const uniqueUserIds = [...new Set(userIds)];

  await Promise.all(uniqueUserIds.map(async (userId) => {
    try {
      await db.notification.create({
        data: {
          userId,
          type: payload.type || 'system',
          title: payload.title,
          message: payload.body || payload.message || '',
          data: payload.data ? JSON.stringify(payload.data) : null,
        },
      });
    } catch {}
  }));

  await sendPushToUsers(uniqueUserIds, payload);
}

// ── Backward-compatible sendPushNotification ──
// Replaces the old push-notifications.ts version with dynamic import
export async function sendPushNotification(
  userId: string,
  payload: PushNotificationPayload
): Promise<{ sent: number; failed: number }> {
  if (!isDatabaseAvailable()) return { sent: 0, failed: 0 };

  // Also store in-app notification
  try {
    await db.notification.create({
      data: {
        userId,
        type: payload.type || 'system',
        title: payload.title,
        message: payload.body,
        data: JSON.stringify({ url: payload.url, ...payload.data }),
      },
    });
  } catch {}

  const wp = await getWebPush();
  if (!wp) return { sent: 0, failed: 0 };

  try {
    const subscriptions = await db.pushSubscription.findMany({
      where: { userId },
    });

    if (subscriptions.length === 0) {
      return { sent: 0, failed: 0 };
    }

    const pushPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || '/icon-192x192.png',
      badge: payload.badge || '/badge-72x72.png',
      tag: payload.tag,
      data: {
        url: payload.url || '/',
        ...payload.data,
      },
    });

    let sent = 0;
    let failed = 0;

    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          const keys = JSON.parse(sub.keys);
          await wp.sendNotification(
            { endpoint: sub.endpoint, keys },
            pushPayload
          );
          sent++;
        } catch (error: unknown) {
          const statusCode = (error as { statusCode?: number })?.statusCode;
          if (statusCode === 410 || statusCode === 404) {
            await db.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
          }
          failed++;
        }
      })
    );

    return { sent, failed };
  } catch {
    return { sent: 0, failed: 0 };
  }
}

// ── Delivery-specific notification helpers ──
// All use dynamic-import web-push (safe from native dep crashes)
// Each helper creates an in-app notification AND sends a push notification

export async function notifyRunnerAssigned(customerId: string, runnerName: string, orderId: string) {
  return notifyUser(customerId, {
    title: 'Runner Assigned! 🏃',
    body: `${runnerName} is on the way to pick up your delivery.`,
    type: 'delivery',
    tag: `delivery-${orderId}`,
    data: { orderId, event: 'runner_assigned', url: `/delivery/${orderId}` },
  });
}

export async function notifyRunnerEnRoute(customerId: string, orderId: string) {
  return notifyUser(customerId, {
    title: 'Runner En Route 🚶',
    body: 'Your runner is heading to the pickup point.',
    type: 'delivery',
    tag: `delivery-${orderId}`,
    data: { orderId, event: 'runner_en_route', url: `/delivery/${orderId}` },
  });
}

export async function notifyPackagePickedUp(customerId: string, orderId: string) {
  return notifyUser(customerId, {
    title: 'Package Picked Up! 📦',
    body: 'Your runner has picked up your package and is on the way.',
    type: 'delivery',
    tag: `delivery-${orderId}`,
    data: { orderId, event: 'picked_up', url: `/delivery/${orderId}` },
  });
}

export async function notifyDeliveryDelivered(customerId: string, orderId: string) {
  return notifyUser(customerId, {
    title: 'Delivered! ✅',
    body: 'Your package has been delivered. Please confirm and rate your runner.',
    type: 'delivery',
    tag: `delivery-${orderId}`,
    data: { orderId, event: 'delivered', url: `/delivery/${orderId}` },
  });
}

export async function notifyDeliveryCancelled(userId: string, reason: string, orderId: string) {
  return notifyUser(userId, {
    title: 'Delivery Cancelled',
    body: reason || 'The delivery has been cancelled.',
    type: 'delivery',
    tag: `delivery-${orderId}`,
    data: { orderId, event: 'cancelled', url: '/delivery' },
  });
}

export async function notifyNewDeliveryOffer(runnerId: string, price: number, title: string) {
  return notifyUser(runnerId, {
    title: 'New Delivery Request! 📋',
    body: `${title} — ₦${price.toLocaleString()}`,
    type: 'delivery',
    data: { event: 'new_offer', url: '/runner' },
  });
}

export async function notifyOfferAccepted(runnerId: string, orderId: string) {
  return notifyUser(runnerId, {
    title: 'Offer Accepted! 🎉',
    body: 'The customer accepted your offer. Head to the pickup point.',
    type: 'delivery',
    tag: `delivery-${orderId}`,
    data: { orderId, event: 'offer_accepted', url: '/runner' },
  });
}

export async function notifyEscrowReleased(runnerId: string, amount: number, orderId: string) {
  return notifyUser(runnerId, {
    title: 'Payment Received! 💰',
    body: `₦${amount.toLocaleString()} has been credited to your wallet.`,
    type: 'payment',
    tag: `payment-${orderId}`,
    data: { orderId, event: 'payment_received', url: '/runner' },
  });
}
