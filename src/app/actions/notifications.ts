"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { notifications, pushSubscriptions } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { newId } from "@/lib/ids";
import { ActionResult, fail, ok, guard } from "@/lib/actionResult";

export async function savePushSubscriptionAction(subJson: string): Promise<ActionResult> {
  return guard(async () => {
    const user = await requireUser();
    let sub: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
    try {
      sub = JSON.parse(subJson);
    } catch {
      return fail("Abonament invalid.");
    }
    if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) return fail("Abonament incomplet.");

    const existing = await db
      .select({ id: pushSubscriptions.id })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, sub.endpoint))
      .limit(1);
    if (existing[0]) {
      await db
        .update(pushSubscriptions)
        .set({ userId: user.id, p256dh: sub.keys.p256dh, auth: sub.keys.auth })
        .where(eq(pushSubscriptions.id, existing[0].id));
    } else {
      await db.insert(pushSubscriptions).values({
        id: newId(),
        userId: user.id,
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
      });
    }
    return ok("Notificările pe telefon sunt active.");
  });
}

export async function deletePushSubscriptionAction(endpoint: string): Promise<ActionResult> {
  return guard(async () => {
    const user = await requireUser();
    await db
      .delete(pushSubscriptions)
      .where(and(eq(pushSubscriptions.userId, user.id), eq(pushSubscriptions.endpoint, endpoint)));
    return ok("Notificările pe telefon au fost oprite.");
  });
}

export async function markNotificationsReadAction(
  _p: ActionResult | null,
  _form: FormData
): Promise<ActionResult> {
  return guard(async () => {
    const user = await requireUser();
    await db.update(notifications).set({ read: true }).where(eq(notifications.userId, user.id));
    revalidatePath("/app/notifications");
    revalidatePath("/app");
    return ok("Toate notificările au fost marcate citite.");
  });
}
