// Server-side push notification sender
import webpush from 'web-push';
import { db, isDatabaseAvailable } from './db';

// Configure VAPID
const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(
    'mailto:admin@unilagmarketplace.com',
    VAPID_PUBLIC,
    VAPID_PRIVATE
  );
}

export interface PushPayload {
  title: string;
  body: string;
  type?: string;
  tag?: string;
  data?: Record<string, unknown>;
  requireInteraction?: boolean;
}

// Send push notification to a specific user
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  if (!isDatabaseAvailable() || !VAPID_PUBLIC || !VAPID_PRIVATE) return 0;

  try {
    const subscriptions = await db.pushSubscription.findMany({
      where: { userId },
    });

    let sent = 0;
    for (const sub of subscriptions) {
      try {
        const keys = JSON.parse(sub.keys);
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys },
          JSON.stringify({
            ...payload,
            data: { ...payload.data, type: payload.type },
          })
        );
        sent++;
      } catch (err: unknown) {
        // If subscription expired (410 Gone), remove it
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

  // Create in-app notification
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

  // Send push notification
  await sendPushToUser(userId, payload);
}
