import "server-only";
import webpush from "web-push";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { locationMembers, notifications, pushSubscriptions } from "@/db/schema";
import { newId } from "./ids";

let vapidReady = false;
function ensureVapid(): boolean {
  if (vapidReady) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@fgm.app", pub, priv);
  vapidReady = true;
  return true;
}

type NotifyInput = { type: string; title: string; body?: string; url?: string };

/** Send a web push to one user's devices; prunes dead subscriptions. */
async function pushToUser(userId: string, payload: NotifyInput) {
  if (!ensureVapid()) return;
  const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  const data = JSON.stringify({ title: payload.title, body: payload.body ?? "", url: payload.url ?? "/app" });
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          data
        );
      } catch (e: any) {
        // 404/410 => subscription gone; remove it.
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, s.id)).catch(() => {});
        }
      }
    })
  );
}

/**
 * Notify all active members of a location (optionally excluding one user):
 * writes an in-app notification row and sends a web push to each.
 */
export async function notifyMembers(locationId: string, payload: NotifyInput, exceptUserId?: string) {
  // Fully best-effort: notifications must never break the action that triggers them
  // (e.g. if the tables aren't migrated yet).
  try {
    const rows = await db
      .select({ userId: locationMembers.userId })
      .from(locationMembers)
      .where(
        exceptUserId
          ? and(eq(locationMembers.locationId, locationId), ne(locationMembers.userId, exceptUserId))
          : eq(locationMembers.locationId, locationId)
      );
    const userIds = rows.map((r) => r.userId);
    if (userIds.length === 0) return;

    const nowSec = Math.floor(Date.now() / 1000);
    await db.insert(notifications).values(
      userIds.map((userId) => ({
        id: newId(),
        userId,
        locationId,
        type: payload.type,
        title: payload.title,
        body: payload.body ?? null,
        url: payload.url ?? null,
        createdAt: nowSec,
      }))
    );

    await Promise.all(userIds.map((id) => pushToUser(id, payload)));
  } catch {
    /* swallow — notifications are non-critical */
  }
}
