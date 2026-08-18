"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  matches,
  matchParticipants,
  teams,
  matchGames,
  matchScorers,
  locationMembers,
  ratingVotes,
} from "@/db/schema";
import { proposeRating, normalizeRating, formatRating } from "@/lib/rating";
import { requireUser } from "@/lib/auth";
import {
  assertLocationAdmin,
  assertLocationMember,
  getMatchLocationId,
  canAdminLocation,
} from "@/lib/permissions";
import { newId } from "@/lib/ids";
import { generateBalancedTeams, TEAM_NAMES, type BalancePlayer } from "@/lib/teams";
import { notifyMembers } from "@/lib/notify";
import { formatDateTime } from "@/lib/format";
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
    if (!startsAt) return fail("Alege data și ora.");

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
    await notifyMembers(
      locationId,
      {
        type: "match_created",
        title: "Meci nou",
        body: `${s(form.get("title")) ? s(form.get("title")) + " · " : ""}${formatDateTime(startsAt)}`,
        url: `/loc/${locationId}/m/${id}`,
      },
      user.id
    );
    revalidatePath(`/loc/${locationId}`);
    return ok("Meci creat.");
  });
}

export async function updateMatchSetupAction(_p: ActionResult | null, form: FormData): Promise<ActionResult> {
  return guard(async () => {
    const user = await requireUser();
    const matchId = s(form.get("matchId"));
    const m = await loadMatch(matchId);
    if (!m) return fail("Meci negăsit.");
    await assertLocationAdmin(user, m.locationId);
    if (m.status === "finished") return fail("Meciul este încheiat.");

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
    revalidatePath(`/loc/${m.locationId}/m/${matchId}`);
    return ok("Meci actualizat.");
  });
}

export async function setMatchStatusAction(_p: ActionResult | null, form: FormData): Promise<ActionResult> {
  return guard(async () => {
    const user = await requireUser();
    const matchId = s(form.get("matchId"));
    const status = s(form.get("status")) as "draft" | "open" | "locked" | "finished";
    const m = await loadMatch(matchId);
    if (!m) return fail("Meci negăsit.");
    await assertLocationAdmin(user, m.locationId);
    await db.update(matches).set({ status }).where(eq(matches.id, matchId));
    revalidatePath(`/loc/${m.locationId}/m/${matchId}`);
    return ok(`Meci marcat ca ${status}.`);
  });
}

/* --------------------------------- RSVP --------------------------------- */

export async function rsvpAction(_p: ActionResult | null, form: FormData): Promise<ActionResult> {
  return guard(async () => {
    const user = await requireUser();
    const matchId = s(form.get("matchId"));
    const choice = s(form.get("choice")) as "going" | "maybe" | "declined";
    const m = await loadMatch(matchId);
    if (!m) return fail("Meci negăsit.");
    await assertLocationMember(user, m.locationId);
    if (m.status === "finished") return fail("Acest meci este încheiat.");
    if (m.status === "locked") return fail("Lista de participanți este blocată.");

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

    revalidatePath(`/loc/${m.locationId}/m/${matchId}`);
    if (finalStatus === "waitlist") return ok("Meciul este plin — ești pe lista de rezerve.");
    return ok("Răspuns salvat.");
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
    if (!m) return fail("Meci negăsit.");
    await assertLocationAdmin(user, m.locationId);
    await db.update(matchParticipants).set({ status: "going" }).where(eq(matchParticipants.id, participantId));
    revalidatePath(`/loc/${m.locationId}/m/${matchId}`);
    return ok("Jucător promovat de pe rezerve.");
  });
}

/** Admin overrides a player's RSVP (e.g. mark a "going" player as "declined"). */
export async function adminSetRsvpAction(_p: ActionResult | null, form: FormData): Promise<ActionResult> {
  return guard(async () => {
    const user = await requireUser();
    const matchId = s(form.get("matchId"));
    const participantId = s(form.get("participantId"));
    const status = s(form.get("status")) as "going" | "maybe" | "declined" | "waitlist";
    const m = await loadMatch(matchId);
    if (!m) return fail("Meci negăsit.");
    await assertLocationAdmin(user, m.locationId);
    if (m.status === "finished") return fail("Meciul este încheiat.");

    const part = (
      await db.select().from(matchParticipants).where(eq(matchParticipants.id, participantId)).limit(1)
    )[0];
    if (!part || part.matchId !== matchId) return fail("Jucător negăsit.");

    const wasGoing = part.status === "going";
    // Dropping someone from the squad also removes any team assignment.
    await db
      .update(matchParticipants)
      .set({ status, teamId: status === "going" ? part.teamId : null })
      .where(eq(matchParticipants.id, participantId));

    // While the list is still open, fill the freed spot from the waitlist.
    if (wasGoing && status !== "going" && m.status === "open") {
      await promoteFirstWaitlist(matchId, m.maxPlayers);
    }

    revalidatePath(`/loc/${m.locationId}/m/${matchId}`);
    const labels = { going: "Vin", maybe: "Poate", declined: "Nu vin", waitlist: "Rezerve" } as const;
    return ok(`Jucător mutat la „${labels[status]}".`);
  });
}

/* --------------------------- Rules confirmation --------------------------- */

export async function confirmRulesAction(_p: ActionResult | null, form: FormData): Promise<ActionResult> {
  return guard(async () => {
    const user = await requireUser();
    const matchId = s(form.get("matchId"));
    const m = await loadMatch(matchId);
    if (!m) return fail("Meci negăsit.");
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
    revalidatePath(`/loc/${m.locationId}/m/${matchId}`);
    return ok("Mulțumim — reguli confirmate.");
  });
}

/* ---------------------------- Lock & generate ---------------------------- */

export async function lockMatchAction(_p: ActionResult | null, form: FormData): Promise<ActionResult> {
  return guard(async () => {
    const user = await requireUser();
    const matchId = s(form.get("matchId"));
    const m = await loadMatch(matchId);
    if (!m) return fail("Meci negăsit.");
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

    if (going.length < m.numTeams) return fail("Nu sunt destui jucători confirmați pentru echipe.");

    for (const p of going) {
      await db.update(matchParticipants).set({ ratingSnapshot: p.rating ?? null }).where(eq(matchParticipants.id, p.id));
    }
    await db.update(matches).set({ status: "locked" }).where(eq(matches.id, matchId));

    // If confirmed players still need a rating, ask everyone to vote.
    const unratedCount = going.filter((p) => p.rating == null).length;
    if (unratedCount > 0) {
      await notifyMembers(m.locationId, {
        type: "vote_needed",
        title: "Votează rankingurile",
        body: `${unratedCount} jucător(i) au nevoie de rating pentru meci. Votează acum.`,
        url: `/loc/${m.locationId}/m/${matchId}`,
      });
    }

    revalidatePath(`/loc/${m.locationId}/m/${matchId}`);
    return ok("Listă de participanți blocată.");
  });
}

export async function generateTeamsAction(_p: ActionResult | null, form: FormData): Promise<ActionResult> {
  return guard(async () => {
    const user = await requireUser();
    const matchId = s(form.get("matchId"));
    const m = await loadMatch(matchId);
    if (!m) return fail("Meci negăsit.");
    await assertLocationAdmin(user, m.locationId);
    if (m.status !== "locked") return fail("Blochează întâi lista de participanți.");

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

    // Unrated players don't block generation: fall back to their community-vote
    // average, or a neutral rating derived from the rated players (or 3).
    // All of these stay fractional — balancing works with the exact numbers.
    const unrated = going.filter((p) => p.rating == null);
    const ratedValues = going.filter((p) => p.rating != null).map((p) => p.rating as number);
    const neutral = ratedValues.length
      ? normalizeRating(ratedValues.reduce((s, v) => s + v, 0) / ratedValues.length)
      : 3;

    const fallback = new Map<string, number>();
    if (unrated.length > 0) {
      const votes = await db
        .select({ targetUserId: ratingVotes.targetUserId, rating: ratingVotes.rating })
        .from(ratingVotes)
        .where(eq(ratingVotes.locationId, m.locationId));
      for (const p of unrated) {
        const theirs = votes.filter((v) => v.targetUserId === p.userId).map((v) => v.rating);
        fallback.set(p.userId, proposeRating(theirs).mean ?? neutral);
      }
    }

    const players: BalancePlayer[] = going.map((p) => ({
      userId: p.userId,
      rating: p.rating ?? fallback.get(p.userId) ?? neutral,
    }));
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
    revalidatePath(`/loc/${m.locationId}/m/${matchId}`);
    const leftover = result.leftoverIds.length;
    const teamSummary = `${m.numTeams} echipe de câte ${teamSize}`;
    const autoNote = unrated.length > 0 ? ` ${unrated.length} jucător(i) fără rating au primit rating automat.` : "";
    return ok(
      (leftover > 0
        ? `${teamSummary} generate (diferență ${formatRating(result.spread)}). ${leftover} jucător(i) au rămas fără echipă — vezi Rezerve.`
        : `${teamSummary} generate (diferență ${formatRating(result.spread)}).`) + autoNote
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
    if (!m) return fail("Meci negăsit.");
    await assertLocationAdmin(user, m.locationId);

    await db
      .update(matchParticipants)
      .set({ teamId })
      .where(and(eq(matchParticipants.matchId, matchId), eq(matchParticipants.userId, userId)));
    await recomputeTeamStrengths(matchId, m.locationId);
    revalidatePath(`/loc/${m.locationId}/m/${matchId}`);
    return ok(teamId ? "Jucător mutat." : "Jucător trecut la rezerve.");
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
    totals.set(r.teamId, (totals.get(r.teamId) ?? 0) + (7 - r.rating));
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
    if (!m) return fail("Meci negăsit.");
    await assertLocationAdmin(user, m.locationId);

    const homeTeamId = s(form.get("homeTeamId"));
    const awayTeamId = s(form.get("awayTeamId"));
    const homeScore = Math.max(0, n(form.get("homeScore")) || 0);
    const awayScore = Math.max(0, n(form.get("awayScore")) || 0);
    if (!homeTeamId || !awayTeamId || homeTeamId === awayTeamId) return fail("Alege două echipe diferite.");

    await db.insert(matchGames).values({
      id: newId(),
      matchId,
      homeTeamId,
      awayTeamId,
      homeScore,
      awayScore,
    });
    revalidatePath(`/loc/${m.locationId}/m/${matchId}`);
    return ok("Scor salvat.");
  });
}

export async function deleteGameAction(_p: ActionResult | null, form: FormData): Promise<ActionResult> {
  return guard(async () => {
    const user = await requireUser();
    const gameId = s(form.get("gameId"));
    const matchId = s(form.get("matchId"));
    const m = await loadMatch(matchId);
    if (!m) return fail("Meci negăsit.");
    await assertLocationAdmin(user, m.locationId);
    await db.delete(matchGames).where(eq(matchGames.id, gameId));
    revalidatePath(`/loc/${m.locationId}/m/${matchId}`);
    return ok("Scor șters.");
  });
}

/** Save goal scorers for a match (goals per player, from `goals-<userId>` fields). */
export async function saveScorersAction(_p: ActionResult | null, form: FormData): Promise<ActionResult> {
  return guard(async () => {
    const user = await requireUser();
    const matchId = s(form.get("matchId"));
    const m = await loadMatch(matchId);
    if (!m) return fail("Meci negăsit.");
    await assertLocationAdmin(user, m.locationId);

    const rows: { id: string; matchId: string; userId: string; goals: number }[] = [];
    let total = 0;
    for (const [key, value] of form.entries()) {
      if (!key.startsWith("goals-")) continue;
      const userId = key.slice("goals-".length);
      const goals = Math.max(0, Math.min(99, Math.floor(Number(value) || 0)));
      if (goals > 0) {
        rows.push({ id: newId(), matchId, userId, goals });
        total += goals;
      }
    }

    await db.delete(matchScorers).where(eq(matchScorers.matchId, matchId));
    if (rows.length) await db.insert(matchScorers).values(rows);

    revalidatePath(`/loc/${m.locationId}/m/${matchId}`);
    revalidatePath(`/loc/${m.locationId}/stats`);
    return ok(`Marcatori salvați (${total} goluri).`);
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
    if (!m) return fail("Meci negăsit.");
    await assertLocationAdmin(user, m.locationId);
    await db.update(matchParticipants).set({ paid }).where(eq(matchParticipants.id, participantId));
    revalidatePath(`/loc/${m.locationId}/m/${matchId}`);
    return ok(paid ? "Marcat plătit." : "Marcat neplătit.");
  });
}
