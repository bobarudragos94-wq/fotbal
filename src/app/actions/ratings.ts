"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { locationMembers, ratingVotes } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { assertLocationAdmin, assertLocationMember, getMembership } from "@/lib/permissions";
import { newId } from "@/lib/ids";
import { ActionResult, fail, ok, guard } from "@/lib/actionResult";

const s = (v: FormDataEntryValue | null) => (v ?? "").toString().trim();

/** Any approved member can vote on an unrated player's rating. */
export async function castRatingVoteAction(_p: ActionResult | null, form: FormData): Promise<ActionResult> {
  return guard(async () => {
    const user = await requireUser();
    const locationId = s(form.get("locationId"));
    const targetUserId = s(form.get("targetUserId"));
    const rating = Number(s(form.get("rating")));
    if (![1, 2, 3, 4].includes(rating)) return fail("Rating must be 1–4.");

    await assertLocationMember(user, locationId);
    if (targetUserId === user.id) return fail("You can't vote on your own rating.");

    const target = await getMembership(targetUserId, locationId);
    if (!target) return fail("That player is not in this location.");
    if (target.rating != null) return fail("That player is already rated.");

    // upsert vote (one per voter/target)
    const existing = await db
      .select({ id: ratingVotes.id })
      .from(ratingVotes)
      .where(
        and(
          eq(ratingVotes.locationId, locationId),
          eq(ratingVotes.targetUserId, targetUserId),
          eq(ratingVotes.voterUserId, user.id)
        )
      )
      .limit(1);

    if (existing[0]) {
      await db.update(ratingVotes).set({ rating }).where(eq(ratingVotes.id, existing[0].id));
    } else {
      await db.insert(ratingVotes).values({
        id: newId(),
        locationId,
        targetUserId,
        voterUserId: user.id,
        rating,
      });
    }
    revalidatePath(`/loc/${locationId}/rate`);
    revalidatePath(`/loc/${locationId}/admin/ratings`);
    return ok("Vote recorded.");
  });
}

/** Admin sets / confirms a player's final rating (1..4). Clears votes. */
export async function setPlayerRatingAction(_p: ActionResult | null, form: FormData): Promise<ActionResult> {
  return guard(async () => {
    const user = await requireUser();
    const locationId = s(form.get("locationId"));
    const targetUserId = s(form.get("targetUserId"));
    const rating = Number(s(form.get("rating")));
    if (![1, 2, 3, 4].includes(rating)) return fail("Rating must be 1–4.");
    await assertLocationAdmin(user, locationId);

    await db
      .update(locationMembers)
      .set({ rating })
      .where(and(eq(locationMembers.userId, targetUserId), eq(locationMembers.locationId, locationId)));

    // Clear votes once confirmed.
    await db
      .delete(ratingVotes)
      .where(and(eq(ratingVotes.locationId, locationId), eq(ratingVotes.targetUserId, targetUserId)));

    revalidatePath(`/loc/${locationId}/admin/ratings`);
    revalidatePath(`/loc/${locationId}/admin/players`);
    return ok("Rating saved.");
  });
}
