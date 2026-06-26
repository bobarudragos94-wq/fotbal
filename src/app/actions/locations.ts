"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  locations,
  locationMembers,
  locationRules,
  joinRequests,
  auditLogs,
  matches,
  matchParticipants,
  teams,
  matchGames,
  ratingVotes,
} from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { assertSuperAdmin, assertLocationAdmin, getMembership } from "@/lib/permissions";
import { newId, inviteCode } from "@/lib/ids";
import { ActionResult, fail, ok, guard } from "@/lib/actionResult";

const s = (v: FormDataEntryValue | null) => (v ?? "").toString().trim();

async function log(locationId: string | null, actorUserId: string, action: string, detail?: string) {
  await db.insert(auditLogs).values({ id: newId(), locationId, actorUserId, action, detail: detail ?? null });
}

/* ----------------------------- Locations ----------------------------- */

/** Any logged-in user can create a location; the creator becomes its admin. */
export async function createLocationAction(_p: ActionResult | null, form: FormData): Promise<ActionResult> {
  return guard(async () => {
    const user = await requireUser();
    const name = s(form.get("name"));
    if (name.length < 2) return fail("Location name is required.");

    const id = newId();
    await db.insert(locations).values({
      id,
      name,
      address: s(form.get("address")) || null,
      description: s(form.get("description")) || null,
      inviteCode: inviteCode(),
      createdBy: user.id,
    });
    await db.insert(locationRules).values({ locationId: id, content: s(form.get("rules")) || "", updatedBy: user.id });
    // Creator joins as admin so the location shows up in their list and they can manage it.
    await db.insert(locationMembers).values({
      id: newId(),
      locationId: id,
      userId: user.id,
      role: "admin",
    });
    await log(id, user.id, "location.create", name);
    revalidatePath("/super/locations");
    revalidatePath("/app");
    return ok("Location created.");
  });
}

export async function updateLocationAction(_p: ActionResult | null, form: FormData): Promise<ActionResult> {
  return guard(async () => {
    const user = await requireUser();
    const id = s(form.get("locationId"));
    // super admin or location admin can edit basics
    if (!user.isSuperAdmin) await assertLocationAdmin(user, id);
    const name = s(form.get("name"));
    if (name.length < 2) return fail("Location name is required.");
    await db
      .update(locations)
      .set({
        name,
        address: s(form.get("address")) || null,
        description: s(form.get("description")) || null,
      })
      .where(eq(locations.id, id));
    await log(id, user.id, "location.update", name);
    revalidatePath(`/super/locations`);
    revalidatePath(`/loc/${id}`);
    return ok("Location updated.");
  });
}

export async function deleteLocationAction(_p: ActionResult | null, form: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!user.isSuperAdmin) return fail("Super admin only.");
  const id = s(form.get("locationId"));

  try {
    // Delete children explicitly (works even if FK cascade isn't enabled on Turso).
    const ms = await db.select({ id: matches.id }).from(matches).where(eq(matches.locationId, id));
    const matchIds = ms.map((m) => m.id);
    if (matchIds.length) {
      await db.delete(matchGames).where(inArray(matchGames.matchId, matchIds));
      await db.delete(teams).where(inArray(teams.matchId, matchIds));
      await db.delete(matchParticipants).where(inArray(matchParticipants.matchId, matchIds));
    }
    await db.delete(matches).where(eq(matches.locationId, id));
    await db.delete(ratingVotes).where(eq(ratingVotes.locationId, id));
    await db.delete(joinRequests).where(eq(joinRequests.locationId, id));
    await db.delete(locationRules).where(eq(locationRules.locationId, id));
    await db.delete(locationMembers).where(eq(locationMembers.locationId, id));
    await db.delete(locations).where(eq(locations.id, id));
    await log(null, user.id, "location.delete", id);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Could not delete location.");
  }

  revalidatePath("/super/locations");
  revalidatePath("/app");
  redirect("/super/locations");
}

export async function setLocationAdminAction(_p: ActionResult | null, form: FormData): Promise<ActionResult> {
  return guard(async () => {
    const user = await requireUser();
    assertSuperAdmin(user);
    const locationId = s(form.get("locationId"));
    const targetUserId = s(form.get("userId"));
    const makeAdmin = s(form.get("role")) === "admin";

    const m = await getMembership(targetUserId, locationId);
    if (!m) return fail("That user is not a member of this location.");
    await db
      .update(locationMembers)
      .set({ role: makeAdmin ? "admin" : "player" })
      .where(and(eq(locationMembers.userId, targetUserId), eq(locationMembers.locationId, locationId)));
    await log(locationId, user.id, makeAdmin ? "admin.grant" : "admin.revoke", targetUserId);
    revalidatePath("/super/admins");
    revalidatePath(`/loc/${locationId}/admin/players`);
    return ok(makeAdmin ? "Promoted to location admin." : "Admin rights revoked.");
  });
}

/* ------------------------------- Joining ------------------------------- */

export async function requestJoinAction(_p: ActionResult | null, form: FormData): Promise<ActionResult> {
  return guard(async () => {
    const user = await requireUser();
    const code = s(form.get("inviteCode")).toUpperCase();
    const byId = s(form.get("locationId"));

    // Joining via a valid invite code auto-approves; browsing without a code
    // still creates a request the admin must approve.
    let loc;
    let viaCode = false;
    if (code) {
      loc = (await db.select().from(locations).where(eq(locations.inviteCode, code)).limit(1))[0];
      viaCode = !!loc;
    } else if (byId) {
      loc = (await db.select().from(locations).where(eq(locations.id, byId)).limit(1))[0];
    }
    if (!loc) return fail("Location not found. Check the invite code.");

    const existingMember = await getMembership(user.id, loc.id);
    if (existingMember) return fail("You are already a member of this location.");

    if (viaCode) {
      // Auto-join: become an active player immediately, no approval needed.
      await db.insert(locationMembers).values({
        id: newId(),
        locationId: loc.id,
        userId: user.id,
        role: "player",
      });
      // Clear any earlier pending request for this location.
      await db
        .update(joinRequests)
        .set({ status: "approved", decidedBy: user.id, decidedAt: Math.floor(Date.now() / 1000) })
        .where(and(eq(joinRequests.locationId, loc.id), eq(joinRequests.userId, user.id), eq(joinRequests.status, "pending")));
      await log(loc.id, user.id, "join.auto");
      revalidatePath("/app");
      return ok(`You've joined ${loc.name}!`);
    }

    const pending = await db
      .select({ id: joinRequests.id })
      .from(joinRequests)
      .where(
        and(
          eq(joinRequests.locationId, loc.id),
          eq(joinRequests.userId, user.id),
          eq(joinRequests.status, "pending")
        )
      )
      .limit(1);
    if (pending[0]) return fail("You already have a pending request for this location.");

    await db.insert(joinRequests).values({
      id: newId(),
      locationId: loc.id,
      userId: user.id,
      message: s(form.get("message")) || null,
    });
    await log(loc.id, user.id, "join.request");
    revalidatePath("/app");
    return ok(`Request sent to ${loc.name}. Waiting for approval.`);
  });
}

export async function decideJoinAction(_p: ActionResult | null, form: FormData): Promise<ActionResult> {
  return guard(async () => {
    const user = await requireUser();
    const requestId = s(form.get("requestId"));
    const approve = s(form.get("decision")) === "approve";

    const req = (await db.select().from(joinRequests).where(eq(joinRequests.id, requestId)).limit(1))[0];
    if (!req) return fail("Request not found.");
    if (req.status !== "pending") return fail("This request was already handled.");
    await assertLocationAdmin(user, req.locationId);

    await db
      .update(joinRequests)
      .set({ status: approve ? "approved" : "rejected", decidedBy: user.id, decidedAt: Math.floor(Date.now() / 1000) })
      .where(eq(joinRequests.id, requestId));

    if (approve) {
      const already = await getMembership(req.userId, req.locationId);
      if (!already) {
        await db.insert(locationMembers).values({
          id: newId(),
          locationId: req.locationId,
          userId: req.userId,
          role: "player",
        });
      }
    }
    await log(req.locationId, user.id, approve ? "join.approve" : "join.reject", req.userId);
    revalidatePath(`/loc/${req.locationId}/admin/pending`);
    revalidatePath("/super/pending");
    return ok(approve ? "Player approved." : "Request rejected.");
  });
}

/* -------------------------------- Rules -------------------------------- */

export async function updateRulesAction(_p: ActionResult | null, form: FormData): Promise<ActionResult> {
  return guard(async () => {
    const user = await requireUser();
    const locationId = s(form.get("locationId"));
    await assertLocationAdmin(user, locationId);
    const content = s(form.get("content"));

    const existing = (await db.select().from(locationRules).where(eq(locationRules.locationId, locationId)).limit(1))[0];
    if (existing) {
      await db
        .update(locationRules)
        .set({ content, version: existing.version + 1, updatedBy: user.id, updatedAt: Math.floor(Date.now() / 1000) })
        .where(eq(locationRules.locationId, locationId));
    } else {
      await db.insert(locationRules).values({ locationId, content, updatedBy: user.id });
    }
    await log(locationId, user.id, "rules.update");
    revalidatePath(`/loc/${locationId}/rules`);
    return ok("Rules updated.");
  });
}
