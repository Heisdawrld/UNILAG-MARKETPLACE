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

// Lazily load web-push to avoid module-level crashes
let webpushConfigured = false;
let webpushModule: typeof import('web-push') | null = null;

async function getWebPush() {
  if (webpushModule) return webpushModule;
  try {
    webpushModule = await import('web-push');
    const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
    const priv = process.env.VAPID_PRIVATE_KEY || '';
    if (pub && priv && !webpushConfigured) {
      webpushModule.default.setVapidDetails('mailto:admin@unilagmarketplace.com', pub, priv);
      webpushConfigured = true;
    }
    return webpushModule;
  } catch {
    return null;
  }
}

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
        await wp.default.sendNotification(
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
