"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { matches, matchParticipants } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { assertLocationAdmin } from "@/lib/permissions";
import { ensureLocationGuests } from "@/lib/guests";
import { newId } from "@/lib/ids";
import { ActionResult, fail, ok, guard } from "@/lib/actionResult";

const s = (v: FormDataEntryValue | null) => (v ?? "").toString().trim();

async function loadMatch(matchId: string) {
  return (await db.select().from(matches).where(eq(matches.id, matchId)).limit(1))[0];
}

/**
 * Admin (or super admin) puts a guest slot on a match list — for the friend
 * someone brings who isn't in the app. Mirrors a normal RSVP: if the match is
 * already full the guest lands on the waitlist.
 */
export async function addGuestToMatchAction(_p: ActionResult | null, form: FormData): Promise<ActionResult> {
  return guard(async () => {
    const user = await requireUser();
    const matchId = s(form.get("matchId"));
    const slot = Number(s(form.get("slot")));
    const m = await loadMatch(matchId);
    if (!m) return fail("Meci negăsit.");
    await assertLocationAdmin(user, m.locationId);
    if (m.status === "finished") return fail("Meciul este încheiat.");

    const guests = await ensureLocationGuests(m.locationId);
    const guest = guests.find((g) => g.slot === slot);
    if (!guest) return fail("Invitatul nu există.");

    const existing = (
      await db
        .select()
        .from(matchParticipants)
        .where(and(eq(matchParticipants.matchId, matchId), eq(matchParticipants.userId, guest.userId)))
        .limit(1)
    )[0];
    if (existing && (existing.status === "going" || existing.status === "waitlist")) {
      return ok("Invitatul era deja pe listă.");
    }

    const going = (
      await db
        .select({ id: matchParticipants.id })
        .from(matchParticipants)
        .where(and(eq(matchParticipants.matchId, matchId), eq(matchParticipants.status, "going")))
    ).length;
    const status = going >= m.maxPlayers ? "waitlist" : "going";

    if (existing) {
      await db
        .update(matchParticipants)
        .set({ status, rsvpAt: Math.floor(Date.now() / 1000) })
        .where(eq(matchParticipants.id, existing.id));
    } else {
      await db.insert(matchParticipants).values({
        id: newId(),
        matchId,
        userId: guest.userId,
        status,
        rulesConfirmed: true, // an admin vouches for the guest they add
      });
    }

    revalidatePath(`/loc/${m.locationId}/m/${matchId}`);
    revalidatePath(`/loc/${m.locationId}`);
    return status === "waitlist"
      ? ok(`Meciul e plin — Invitat ${slot} a intrat pe rezerve.`)
      : ok(`Invitat ${slot} adăugat pe listă.`);
  });
}

/** Admin takes a guest slot back off the match — the row goes away entirely. */
export async function removeGuestFromMatchAction(_p: ActionResult | null, form: FormData): Promise<ActionResult> {
  return guard(async () => {
    const user = await requireUser();
    const matchId = s(form.get("matchId"));
    const slot = Number(s(form.get("slot")));
    const m = await loadMatch(matchId);
    if (!m) return fail("Meci negăsit.");
    await assertLocationAdmin(user, m.locationId);
    if (m.status === "finished") return fail("Meciul este încheiat.");

    const guests = await ensureLocationGuests(m.locationId);
    const guest = guests.find((g) => g.slot === slot);
    if (!guest) return fail("Invitatul nu există.");

    await db
      .delete(matchParticipants)
      .where(and(eq(matchParticipants.matchId, matchId), eq(matchParticipants.userId, guest.userId)));

    revalidatePath(`/loc/${m.locationId}/m/${matchId}`);
    revalidatePath(`/loc/${m.locationId}`);
    return ok(`Invitat ${slot} scos de pe listă.`);
  });
}
