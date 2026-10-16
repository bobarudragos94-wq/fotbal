"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { matches, matchParticipants } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { assertLocationAdmin } from "@/lib/permissions";
import { takeGuestOfRating, isLocationGuest, GUEST_RATINGS } from "@/lib/guests";
import { newId } from "@/lib/ids";
import { ActionResult, fail, ok, guard } from "@/lib/actionResult";

const s = (v: FormDataEntryValue | null) => (v ?? "").toString().trim();

async function loadMatch(matchId: string) {
  return (await db.select().from(matches).where(eq(matches.id, matchId)).limit(1))[0];
}

/**
 * Admin (or super admin) adds one guest of the given rating to a match — for a
 * friend someone brings who isn't in the app. Can be used repeatedly for the
 * same rating. Mirrors a normal RSVP: a full match puts the guest on the
 * waitlist.
 */
export async function addGuestToMatchAction(_p: ActionResult | null, form: FormData): Promise<ActionResult> {
  return guard(async () => {
    const user = await requireUser();
    const matchId = s(form.get("matchId"));
    const rating = Number(s(form.get("rating")));
    if (!GUEST_RATINGS.includes(rating)) return fail("Nota invitatului trebuie să fie 1–6.");

    const m = await loadMatch(matchId);
    if (!m) return fail("Meci negăsit.");
    await assertLocationAdmin(user, m.locationId);
    if (m.status === "finished") return fail("Meciul este încheiat.");

    const onMatch = await db
      .select({ userId: matchParticipants.userId, status: matchParticipants.status })
      .from(matchParticipants)
      .where(eq(matchParticipants.matchId, matchId));

    const taken = new Set(onMatch.map((p) => p.userId));
    const guest = await takeGuestOfRating(m.locationId, rating, taken);

    const going = onMatch.filter((p) => p.status === "going").length;
    const status = going >= m.maxPlayers ? "waitlist" : "going";

    await db.insert(matchParticipants).values({
      id: newId(),
      matchId,
      userId: guest.userId,
      status,
      rulesConfirmed: true, // the admin adding them vouches for the guest
    });

    revalidatePath(`/loc/${m.locationId}/m/${matchId}`);
    revalidatePath(`/loc/${m.locationId}`);
    return status === "waitlist"
      ? ok(`Meciul e plin — ${guest.name} a intrat pe rezerve.`)
      : ok(`${guest.name} adăugat pe listă.`);
  });
}

/** Admin takes one guest back off the match — the row goes away entirely. */
export async function removeGuestFromMatchAction(_p: ActionResult | null, form: FormData): Promise<ActionResult> {
  return guard(async () => {
    const user = await requireUser();
    const matchId = s(form.get("matchId"));
    const userId = s(form.get("userId"));
    const m = await loadMatch(matchId);
    if (!m) return fail("Meci negăsit.");
    await assertLocationAdmin(user, m.locationId);
    if (m.status === "finished") return fail("Meciul este încheiat.");
    if (!(await isLocationGuest(userId, m.locationId))) return fail("Acela nu este un invitat.");

    await db
      .delete(matchParticipants)
      .where(and(eq(matchParticipants.matchId, matchId), eq(matchParticipants.userId, userId)));

    revalidatePath(`/loc/${m.locationId}/m/${matchId}`);
    revalidatePath(`/loc/${m.locationId}`);
    return ok("Invitat scos de pe listă.");
  });
}
