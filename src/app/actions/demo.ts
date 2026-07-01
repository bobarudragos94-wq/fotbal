"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, like, or } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import {
  users,
  locationMembers,
  ratingVotes,
  matchParticipants,
  matches,
} from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { assertLocationAdmin } from "@/lib/permissions";
import { newId } from "@/lib/ids";
import { ActionResult, fail, ok, guard } from "@/lib/actionResult";

const DEMO_EMAIL = "@demo.local";
const DEMO_TARGET = 18;

const DEMO_NAMES = [
  "Ghost", "Tank", "Sniper", "Rocket", "Maverick", "Bolt", "Falcon", "Viper",
  "Shadow", "Blaze", "Titan", "Hawk", "Storm", "Ace", "Wolf", "Comet",
  "Ranger", "Zeus",
];

/** True if a user row is a generated demo account. */
async function demoMemberIds(locationId: string): Promise<string[]> {
  const rows = await db
    .select({ id: users.id })
    .from(locationMembers)
    .innerJoin(users, eq(users.id, locationMembers.userId))
    .where(and(eq(locationMembers.locationId, locationId), like(users.email, `%${DEMO_EMAIL}`)));
  return rows.map((r) => r.id);
}

/** Add demo players (up to 18 total) to a location for testing. */
export async function addDemoPlayersAction(_p: ActionResult | null, form: FormData): Promise<ActionResult> {
  return guard(async () => {
    const user = await requireUser();
    const locationId = (form.get("locationId") ?? "").toString();
    await assertLocationAdmin(user, locationId);

    const existing = await demoMemberIds(locationId);
    const toAdd = DEMO_TARGET - existing.length;
    if (toAdd <= 0) return fail(`Ai deja ${existing.length} jucători demo aici. Șterge-i întâi ca să-i readaugi.`);

    const hash = await bcrypt.hash("demo1234", 10);
    const created: string[] = [];

    for (let i = 0; i < toAdd; i++) {
      const idx = existing.length + i;
      const nick = DEMO_NAMES[idx % DEMO_NAMES.length] + (idx >= DEMO_NAMES.length ? `-${idx}` : "");
      const uid = newId();
      // unique-ish email per location + index
      const email = `demo-${locationId.slice(0, 8)}-${idx}${DEMO_EMAIL}`;
      await db.insert(users).values({
        id: uid,
        name: `Demo ${nick}`,
        nickname: nick,
        email,
        passwordHash: hash,
      });
      // Spread ratings 1..4; leave the last 5 unrated so the vote flow is testable.
      const rating = idx >= DEMO_TARGET - 5 ? null : ((idx % 6) + 1);
      await db.insert(locationMembers).values({
        id: newId(),
        locationId,
        userId: uid,
        role: "player",
        rating,
      });
      created.push(uid);
    }

    // Seed a couple of votes for each unrated demo (from other demos) so the
    // admin sees a proposed rating to confirm.
    const allDemos = await db
      .select({ id: locationMembers.userId, rating: locationMembers.rating })
      .from(locationMembers)
      .innerJoin(users, eq(users.id, locationMembers.userId))
      .where(and(eq(locationMembers.locationId, locationId), like(users.email, `%${DEMO_EMAIL}`)));
    const unratedIds = allDemos.filter((d) => d.rating == null).map((d) => d.id);
    const voterIds = allDemos.filter((d) => d.rating != null).map((d) => d.id).slice(0, 3);
    for (const target of unratedIds) {
      let r = 2;
      for (const voter of voterIds) {
        if (voter === target) continue;
        // skip if already voted
        const has = await db
          .select({ id: ratingVotes.id })
          .from(ratingVotes)
          .where(and(eq(ratingVotes.locationId, locationId), eq(ratingVotes.targetUserId, target), eq(ratingVotes.voterUserId, voter)))
          .limit(1);
        if (has[0]) continue;
        await db.insert(ratingVotes).values({
          id: newId(), locationId, targetUserId: target, voterUserId: voter, rating: r,
        });
        r = r === 2 ? 3 : 2;
      }
    }

    revalidatePath(`/loc/${locationId}/admin/players`);
    revalidatePath(`/loc/${locationId}/stats`);
    return ok(`Adăugați ${toAdd} jucători demo. Parola pentru toți: demo1234.`);
  });
}

/** Remove every demo player from a location (and clean up their data). */
export async function removeDemoPlayersAction(_p: ActionResult | null, form: FormData): Promise<ActionResult> {
  return guard(async () => {
    const user = await requireUser();
    const locationId = (form.get("locationId") ?? "").toString();
    await assertLocationAdmin(user, locationId);

    const ids = await demoMemberIds(locationId);
    if (ids.length === 0) return fail("Nu există jucători demo de șters.");

    // Delete children first (works whether or not FK cascade is enabled).
    await db.delete(matchParticipants).where(inArray(matchParticipants.userId, ids));
    await db.delete(ratingVotes).where(or(inArray(ratingVotes.targetUserId, ids), inArray(ratingVotes.voterUserId, ids)));
    await db.delete(locationMembers).where(inArray(locationMembers.userId, ids));
    await db.delete(users).where(inArray(users.id, ids));

    revalidatePath(`/loc/${locationId}/admin/players`);
    revalidatePath(`/loc/${locationId}/stats`);
    return ok(`Șterși ${ids.length} jucători demo.`);
  });
}

/** Mark all demo players as "going" for a match (fills the confirmed list for testing). */
export async function fillMatchWithDemosAction(_p: ActionResult | null, form: FormData): Promise<ActionResult> {
  return guard(async () => {
    const user = await requireUser();
    const matchId = (form.get("matchId") ?? "").toString();
    const m = (await db.select().from(matches).where(eq(matches.id, matchId)).limit(1))[0];
    if (!m) return fail("Meci negăsit.");
    await assertLocationAdmin(user, m.locationId);
    if (m.status !== "open" && m.status !== "draft") return fail("Deschide întâi meciul pentru înscrieri.");

    const demos = await demoMemberIds(m.locationId);
    if (demos.length === 0) return fail("Nu există jucători demo în această locație. Adaugă-i întâi din pagina Jucători.");

    let goingCount = (
      await db
        .select({ id: matchParticipants.id })
        .from(matchParticipants)
        .where(and(eq(matchParticipants.matchId, matchId), eq(matchParticipants.status, "going")))
    ).length;

    let added = 0;
    for (const uid of demos) {
      const existing = (
        await db
          .select()
          .from(matchParticipants)
          .where(and(eq(matchParticipants.matchId, matchId), eq(matchParticipants.userId, uid)))
          .limit(1)
      )[0];
      const status = goingCount < m.maxPlayers ? "going" : "waitlist";
      if (existing) {
        if (existing.status !== "going") {
          await db.update(matchParticipants).set({ status }).where(eq(matchParticipants.id, existing.id));
          if (status === "going") goingCount++;
        }
      } else {
        await db.insert(matchParticipants).values({ id: newId(), matchId, userId: uid, status });
        if (status === "going") goingCount++;
        added++;
      }
    }
    revalidatePath(`/loc/${m.locationId}/m/${matchId}`);
    return ok(`Jucători demo adăugați la meci (${goingCount} confirmați).`);
  });
}
