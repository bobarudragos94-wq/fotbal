"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  matches,
  matchParticipants,
  teams,
  matchGames,
  locationMembers,
} from "@/db/schema";
import { requireUser } from "@/lib/auth";
import {
  assertLocationAdmin,
  assertLocationMember,
  getMatchLocationId,
  canAdminLocation,
} from "@/lib/permissions";
import { newId } from "@/lib/ids";
import { generateBalancedTeams, TEAM_NAMES, type BalancePlayer } from "@/lib/teams";
import { ActionResult, fail, ok, guard } from "@/lib/actionResult";

const s = (v: FormDataEntryValue | null) => (v ?? "").toString().trim();
const n = (v: FormDataEntryValue | null) => Number(s(v));

async function loadMatch(matchId: string) {
  return (await db.select().from(matches).where(eq(matches.id, matchId)).limit(1))[0];
}

/* ------------------------------ Create / setup ------------------------------ */

export async function createMatchAction(_p: ActionResult | null, form: FormData): Promise<ActionResult> {
  return guard(async () => {
    const user = await requireUser();
    const locationId = s(form.get("locationId"));
    await assertLocationAdmin(user, locationId);

    const startsAtLocal = s(form.get("startsAt"));
    const startsAt = startsAtLocal ? Math.floor(new Date(startsAtLocal).getTime() / 1000) : 0;
    if (!startsAt) return fail("Please pick a date and time.");

    const numTeams = Math.max(2, Math.min(6, n(form.get("numTeams")) || 2));
    const playersPerTeam = Math.max(1, n(form.get("playersPerTeam")) || 6);
    const maxPlayers = Math.max(numTeams, n(form.get("maxPlayers")) || numTeams * playersPerTeam);

    const id = newId();
    await db.insert(matches).values({
      id,
      locationId,
      title: s(form.get("title")) || null,
      startsAt,
      numTeams,
      playersPerTeam,
      maxPlayers,
      status: "open",
      pitchCost: s(form.get("pitchCost")) ? n(form.get("pitchCost")) : null,
      notes: s(form.get("notes")) || null,
      createdBy: user.id,
    });
    revalidatePath(`/app/l/${locationId}/matches`);
    return ok("Match created.");
  });
}

export async function updateMatchSetupAction(_p: ActionResult | null, form: FormData): Promise<ActionResult> {
  return guard(async () => {
    const user = await requireUser();
    const matchId = s(form.get("matchId"));
    const m = await loadMatch(matchId);
    if (!m) return fail("Match not found.");
    await assertLocationAdmin(user, m.locationId);
    if (m.status === "finished") return fail("Match is finished.");

    const numTeams = Math.max(2, Math.min(6, n(form.get("numTeams")) || m.numTeams));
    const playersPerTeam = Math.max(1, n(form.get("playersPerTeam")) || m.playersPerTeam);
    const maxPlayers = Math.max(numTeams, n(form.get("maxPlayers")) || m.maxPlayers);
    const startsAtLocal = s(form.get("startsAt"));

    await db
      .update(matches)
      .set({
        title: s(form.get("title")) || null,
        numTeams,
        playersPerTeam,
        maxPlayers,
        startsAt: startsAtLocal ? Math.floor(new Date(startsAtLocal).getTime() / 1000) : m.startsAt,
        pitchCost: s(form.get("pitchCost")) ? n(form.get("pitchCost")) : null,
        notes: s(form.get("notes")) || null,
      })
      .where(eq(matches.id, matchId));
    revalidatePath(`/app/l/${m.locationId}/m/${matchId}`);
    return ok("Match updated.");
  });
}

export async function setMatchStatusAction(_p: ActionResult | null, form: FormData): Promise<ActionResult> {
  return guard(async () => {
    const user = await requireUser();
    const matchId = s(form.get("matchId"));
    const status = s(form.get("status")) as "draft" | "open" | "locked" | "finished";
    const m = await loadMatch(matchId);
    if (!m) return fail("Match not found.");
    await assertLocationAdmin(user, m.locationId);
    await db.update(matches).set({ status }).where(eq(matches.id, matchId));
    revalidatePath(`/app/l/${m.locationId}/m/${matchId}`);
    return ok(`Match marked ${status}.`);
  });
}

/* --------------------------------- RSVP --------------------------------- */

export async function rsvpAction(_p: ActionResult | null, form: FormData): Promise<ActionResult> {
  return guard(async () => {
    const user = await requireUser();
    const matchId = s(form.get("matchId"));
    const choice = s(form.get("choice")) as "going" | "maybe" | "declined";
    const m = await loadMatch(matchId);
    if (!m) return fail("Match not found.");
    await assertLocationMember(user, m.locationId);
    if (m.status === "finished") return fail("This match is finished.");
    if (m.status === "locked") return fail("The participant list is locked.");

    const goingCount = (
      await db
        .select({ id: matchParticipants.id })
        .from(matchParticipants)
        .where(and(eq(matchParticipants.matchId, matchId), eq(matchParticipants.status, "going")))
    ).length;

    const existing = (
      await db
        .select()
        .from(matchParticipants)
        .where(and(eq(matchParticipants.matchId, matchId), eq(matchParticipants.userId, user.id)))
        .limit(1)
    )[0];

    let finalStatus: "going" | "maybe" | "declined" | "waitlist" = choice;
    if (choice === "going") {
      const alreadyGoing = existing?.status === "going";
      if (!alreadyGoing && goingCount >= m.maxPlayers) finalStatus = "waitlist";
    }

    if (existing) {
      await db
        .update(matchParticipants)
        .set({ status: finalStatus, rsvpAt: existing.status === finalStatus ? existing.rsvpAt : Math.floor(Date.now() / 1000) })
        .where(eq(matchParticipants.id, existing.id));
    } else {
      await db.insert(matchParticipants).values({
        id: newId(),
        matchId,
        userId: user.id,
        status: finalStatus,
      });
    }

    // If this user left a "going" spot, auto-promote the first waitlisted player.
    if (existing?.status === "going" && finalStatus !== "going") {
      await promoteFirstWaitlist(matchId, m.maxPlayers);
    }

    revalidatePath(`/app/l/${m.locationId}/m/${matchId}`);
    if (finalStatus === "waitlist") return ok("Match is full — you're on the waitlist.");
    return ok("RSVP saved.");
  });
}

async function promoteFirstWaitlist(matchId: string, maxPlayers: number) {
  const going = (
    await db
      .select({ id: matchParticipants.id })
      .from(matchParticipants)
      .where(and(eq(matchParticipants.matchId, matchId), eq(matchParticipants.status, "going")))
  ).length;
  if (going >= maxPlayers) return;
  const first = (
    await db
      .select()
      .from(matchParticipants)
      .where(and(eq(matchParticipants.matchId, matchId), eq(matchParticipants.status, "waitlist")))
      .orderBy(asc(matchParticipants.rsvpAt))
      .limit(1)
  )[0];
  if (first) {
    await db.update(matchParticipants).set({ status: "going" }).where(eq(matchParticipants.id, first.id));
  }
}

/** Admin promotes a specific waitlisted player into "going". */
export async function promoteWaitlistAction(_p: ActionResult | null, form: FormData): Promise<ActionResult> {
  return guard(async () => {
    const user = await requireUser();
    const matchId = s(form.get("matchId"));
    const participantId = s(form.get("participantId"));
    const m = await loadMatch(matchId);
    if (!m) return fail("Match not found.");
    await assertLocationAdmin(user, m.locationId);
    await db.update(matchParticipants).set({ status: "going" }).where(eq(matchParticipants.id, participantId));
    revalidatePath(`/app/l/${m.locationId}/m/${matchId}`);
    return ok("Player promoted from waitlist.");
  });
}

/* --------------------------- Rules confirmation --------------------------- */

export async function confirmRulesAction(_p: ActionResult | null, form: FormData): Promise<ActionResult> {
  return guard(async () => {
    const user = await requireUser();
    const matchId = s(form.get("matchId"));
    const m = await loadMatch(matchId);
    if (!m) return fail("Match not found.");
    await assertLocationMember(user, m.locationId);

    const existing = (
      await db
        .select()
        .from(matchParticipants)
        .where(and(eq(matchParticipants.matchId, matchId), eq(matchParticipants.userId, user.id)))
        .limit(1)
    )[0];
    if (existing) {
      await db.update(matchParticipants).set({ rulesConfirmed: true }).where(eq(matchParticipants.id, existing.id));
    } else {
      await db.insert(matchParticipants).values({
        id: newId(),
        matchId,
        userId: user.id,
        status: "maybe",
        rulesConfirmed: true,
      });
    }
    revalidatePath(`/app/l/${m.locationId}/m/${matchId}`);
    return ok("Thanks — rules confirmed.");
  });
}

/* ---------------------------- Lock & generate ---------------------------- */

export async function lockMatchAction(_p: ActionResult | null, form: FormData): Promise<ActionResult> {
  return guard(async () => {
    const user = await requireUser();
    const matchId = s(form.get("matchId"));
    const m = await loadMatch(matchId);
    if (!m) return fail("Match not found.");
    await assertLocationAdmin(user, m.locationId);

    // Snapshot current ratings for "going" players.
    const going = await db
      .select({
        id: matchParticipants.id,
        userId: matchParticipants.userId,
        rating: locationMembers.rating,
      })
      .from(matchParticipants)
      .innerJoin(
        locationMembers,
        and(eq(locationMembers.userId, matchParticipants.userId), eq(locationMembers.locationId, m.locationId))
      )
      .where(and(eq(matchParticipants.matchId, matchId), eq(matchParticipants.status, "going")));

    if (going.length < m.numTeams) return fail("Not enough confirmed players to form the teams.");

    for (const p of going) {
      await db.update(matchParticipants).set({ ratingSnapshot: p.rating ?? null }).where(eq(matchParticipants.id, p.id));
    }
    await db.update(matches).set({ status: "locked" }).where(eq(matches.id, matchId));
    revalidatePath(`/app/l/${m.locationId}/m/${matchId}`);
    return ok("Participants locked.");
  });
}

export async function generateTeamsAction(_p: ActionResult | null, form: FormData): Promise<ActionResult> {
  return guard(async () => {
    const user = await requireUser();
    const matchId = s(form.get("matchId"));
    const m = await loadMatch(matchId);
    if (!m) return fail("Match not found.");
    await assertLocationAdmin(user, m.locationId);
    if (m.status !== "locked") return fail("Lock the participant list first.");

    const going = await db
      .select({
        userId: matchParticipants.userId,
        rating: locationMembers.rating,
      })
      .from(matchParticipants)
      .innerJoin(
        locationMembers,
        and(eq(locationMembers.userId, matchParticipants.userId), eq(locationMembers.locationId, m.locationId))
      )
      .where(and(eq(matchParticipants.matchId, matchId), eq(matchParticipants.status, "going")));

    const unrated = going.filter((p) => p.rating == null);
    if (unrated.length > 0) {
      return fail(`${unrated.length} player(s) still unrated. Confirm all ratings before generating teams.`);
    }

    const players: BalancePlayer[] = going.map((p) => ({ userId: p.userId, rating: p.rating! }));
    // Equal teams: cap team size at the match's playersPerTeam but no bigger than
    // the squad allows (floor(N / numTeams)). Extras become reserves (no team).
    const teamSize = Math.max(1, Math.min(m.playersPerTeam, Math.floor(going.length / m.numTeams)));
    const result = generateBalancedTeams(players, m.numTeams, teamSize);

    // Replace any existing teams + assignments.
    await db.delete(teams).where(eq(teams.matchId, matchId));
    await db.update(matchParticipants).set({ teamId: null }).where(eq(matchParticipants.matchId, matchId));

    for (const t of result.teams) {
      const teamId = newId();
      await db.insert(teams).values({
        id: teamId,
        matchId,
        name: `Team ${TEAM_NAMES[t.index]}`,
        colorIndex: t.index,
        totalStrength: t.totalStrength,
      });
      for (const userId of t.playerIds) {
        await db
          .update(matchParticipants)
          .set({ teamId })
          .where(and(eq(matchParticipants.matchId, matchId), eq(matchParticipants.userId, userId)));
      }
    }
    await db.update(matches).set({ teamsGeneratedAt: Math.floor(Date.now() / 1000) }).where(eq(matches.id, matchId));
    revalidatePath(`/app/l/${m.locationId}/m/${matchId}`);
    const leftover = result.leftoverIds.length;
    const teamSummary = `${m.numTeams} teams of ${teamSize}`;
    return ok(
      leftover > 0
        ? `${teamSummary} generated (spread ${result.spread}). ${leftover} player(s) left without a team — see Reserves.`
        : `${teamSummary} generated (spread ${result.spread}).`
    );
  });
}

/** Admin moves a player to a specific team (manual edit). */
export async function movePlayerToTeamAction(_p: ActionResult | null, form: FormData): Promise<ActionResult> {
  return guard(async () => {
    const user = await requireUser();
    const matchId = s(form.get("matchId"));
    const userId = s(form.get("userId"));
    const teamIdRaw = s(form.get("teamId"));
    const teamId = teamIdRaw || null; // empty -> bench to reserves
    const m = await loadMatch(matchId);
    if (!m) return fail("Match not found.");
    await assertLocationAdmin(user, m.locationId);

    await db
      .update(matchParticipants)
      .set({ teamId })
      .where(and(eq(matchParticipants.matchId, matchId), eq(matchParticipants.userId, userId)));
    await recomputeTeamStrengths(matchId, m.locationId);
    revalidatePath(`/app/l/${m.locationId}/m/${matchId}`);
    return ok(teamId ? "Player moved." : "Player benched to reserves.");
  });
}

async function recomputeTeamStrengths(matchId: string, locationId: string) {
  const rows = await db
    .select({ teamId: matchParticipants.teamId, rating: locationMembers.rating })
    .from(matchParticipants)
    .innerJoin(
      locationMembers,
      and(eq(locationMembers.userId, matchParticipants.userId), eq(locationMembers.locationId, locationId))
    )
    .where(eq(matchParticipants.matchId, matchId));
  const totals = new Map<string, number>();
  for (const r of rows) {
    if (!r.teamId || r.rating == null) continue;
    totals.set(r.teamId, (totals.get(r.teamId) ?? 0) + (5 - r.rating));
  }
  for (const [teamId, total] of totals) {
    await db.update(teams).set({ totalStrength: total }).where(eq(teams.id, teamId));
  }
}

/* -------------------------------- Scores -------------------------------- */

export async function saveGameAction(_p: ActionResult | null, form: FormData): Promise<ActionResult> {
  return guard(async () => {
    const user = await requireUser();
    const matchId = s(form.get("matchId"));
    const m = await loadMatch(matchId);
    if (!m) return fail("Match not found.");
    await assertLocationAdmin(user, m.locationId);

    const homeTeamId = s(form.get("homeTeamId"));
    const awayTeamId = s(form.get("awayTeamId"));
    const homeScore = Math.max(0, n(form.get("homeScore")) || 0);
    const awayScore = Math.max(0, n(form.get("awayScore")) || 0);
    if (!homeTeamId || !awayTeamId || homeTeamId === awayTeamId) return fail("Pick two different teams.");

    await db.insert(matchGames).values({
      id: newId(),
      matchId,
      homeTeamId,
      awayTeamId,
      homeScore,
      awayScore,
    });
    revalidatePath(`/app/l/${m.locationId}/m/${matchId}`);
    return ok("Score saved.");
  });
}

export async function deleteGameAction(_p: ActionResult | null, form: FormData): Promise<ActionResult> {
  return guard(async () => {
    const user = await requireUser();
    const gameId = s(form.get("gameId"));
    const matchId = s(form.get("matchId"));
    const m = await loadMatch(matchId);
    if (!m) return fail("Match not found.");
    await assertLocationAdmin(user, m.locationId);
    await db.delete(matchGames).where(eq(matchGames.id, gameId));
    revalidatePath(`/app/l/${m.locationId}/m/${matchId}`);
    return ok("Score removed.");
  });
}

/* -------------------------------- Payments -------------------------------- */

export async function togglePaidAction(_p: ActionResult | null, form: FormData): Promise<ActionResult> {
  return guard(async () => {
    const user = await requireUser();
    const matchId = s(form.get("matchId"));
    const participantId = s(form.get("participantId"));
    const paid = s(form.get("paid")) === "true";
    const m = await loadMatch(matchId);
    if (!m) return fail("Match not found.");
    await assertLocationAdmin(user, m.locationId);
    await db.update(matchParticipants).set({ paid }).where(eq(matchParticipants.id, participantId));
    revalidatePath(`/app/l/${m.locationId}/m/${matchId}`);
    return ok(paid ? "Marked paid." : "Marked unpaid.");
  });
}
