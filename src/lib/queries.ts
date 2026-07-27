import "server-only";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  locations,
  locationMembers,
  locationRules,
  joinRequests,
  ratingVotes,
  matches,
  matchParticipants,
  teams,
  matchGames,
  matchScorers,
  users,
  notifications,
} from "@/db/schema";
import { computeStandings } from "./standings";
import { proposeRating } from "./rating";

/** Public display name: the nickname if set, otherwise the real name. */
export const displayName = sql<string>`coalesce(nullif(${users.nickname}, ''), ${users.name})`;

export async function getUserLocations(userId: string) {
  const rows = await db
    .select({
      id: locations.id,
      name: locations.name,
      address: locations.address,
      role: locationMembers.role,
      rating: locationMembers.rating,
    })
    .from(locationMembers)
    .innerJoin(locations, eq(locations.id, locationMembers.locationId))
    .where(eq(locationMembers.userId, userId))
    .orderBy(asc(locations.name));
  return rows;
}

export async function getMemberCounts(locationIds: string[]) {
  if (locationIds.length === 0) return new Map<string, number>();
  const rows = await db
    .select({ locationId: locationMembers.locationId, c: sql<number>`count(*)` })
    .from(locationMembers)
    .where(inArray(locationMembers.locationId, locationIds))
    .groupBy(locationMembers.locationId);
  return new Map(rows.map((r) => [r.locationId, Number(r.c)]));
}

export async function getUserPendingRequests(userId: string) {
  return db
    .select({
      id: joinRequests.id,
      status: joinRequests.status,
      locationName: locations.name,
      createdAt: joinRequests.createdAt,
    })
    .from(joinRequests)
    .innerJoin(locations, eq(locations.id, joinRequests.locationId))
    .where(and(eq(joinRequests.userId, userId), eq(joinRequests.status, "pending")))
    .orderBy(desc(joinRequests.createdAt));
}

export async function getLocation(id: string) {
  return (await db.select().from(locations).where(eq(locations.id, id)).limit(1))[0];
}

export async function getRules(locationId: string) {
  return (await db.select().from(locationRules).where(eq(locationRules.locationId, locationId)).limit(1))[0];
}

export async function getLocationMembers(locationId: string) {
  return db
    .select({
      userId: users.id,
      name: displayName,
      email: users.email,
      avatarUrl: users.avatarUrl,
      role: locationMembers.role,
      rating: locationMembers.rating,
    })
    .from(locationMembers)
    .innerJoin(users, eq(users.id, locationMembers.userId))
    .where(eq(locationMembers.locationId, locationId))
    .orderBy(asc(users.name));
}

export async function getPendingJoinRequests(locationId: string) {
  return db
    .select({
      id: joinRequests.id,
      message: joinRequests.message,
      createdAt: joinRequests.createdAt,
      userId: users.id,
      name: displayName,
      email: users.email,
      phone: users.phone,
      avatarUrl: users.avatarUrl,
    })
    .from(joinRequests)
    .innerJoin(users, eq(users.id, joinRequests.userId))
    .where(and(eq(joinRequests.locationId, locationId), eq(joinRequests.status, "pending")))
    .orderBy(asc(joinRequests.createdAt));
}

/** Unrated members + aggregated community votes; flags whether `voterId` voted. */
export async function getUnratedPlayers(locationId: string, voterId: string) {
  const unrated = await db
    .select({ userId: users.id, name: displayName, avatarUrl: users.avatarUrl })
    .from(locationMembers)
    .innerJoin(users, eq(users.id, locationMembers.userId))
    .where(and(eq(locationMembers.locationId, locationId), sql`${locationMembers.rating} is null`))
    .orderBy(asc(users.name));

  if (unrated.length === 0) return [];

  const votes = await db
    .select({ targetUserId: ratingVotes.targetUserId, voterUserId: ratingVotes.voterUserId, rating: ratingVotes.rating })
    .from(ratingVotes)
    .where(eq(ratingVotes.locationId, locationId));

  return unrated.map((u) => {
    const v = votes.filter((x) => x.targetUserId === u.userId);
    const proposal = proposeRating(v.map((x) => x.rating));
    const myVote = v.find((x) => x.voterUserId === voterId)?.rating ?? null;
    return { ...u, proposal, myVote };
  });
}

export async function getMatches(locationId: string) {
  const rows = await db
    .select({
      id: matches.id,
      title: matches.title,
      startsAt: matches.startsAt,
      status: matches.status,
      numTeams: matches.numTeams,
      playersPerTeam: matches.playersPerTeam,
      maxPlayers: matches.maxPlayers,
      // NOTE: the outer column must be written qualified ("matches"."id"). Passing
      // ${matches.id} here renders as bare "id", which a correlated subquery resolves
      // against its own table — silently counting nothing.
      going: sql<number>`(select count(*) from match_participants mp where mp.match_id = "matches"."id" and mp.status = 'going')`,
    })
    .from(matches)
    .where(eq(matches.locationId, locationId))
    .orderBy(desc(matches.startsAt));
  return rows;
}

export async function getMatch(matchId: string) {
  return (await db.select().from(matches).where(eq(matches.id, matchId)).limit(1))[0];
}

export type ParticipantRow = {
  participantId: string;
  userId: string;
  name: string;
  avatarUrl: string | null;
  status: "going" | "maybe" | "declined" | "waitlist";
  rating: number | null;
  teamId: string | null;
  rulesConfirmed: boolean;
  paid: boolean;
  rsvpAt: number;
};

export async function getMatchParticipants(matchId: string, locationId: string): Promise<ParticipantRow[]> {
  return db
    .select({
      participantId: matchParticipants.id,
      userId: users.id,
      name: displayName,
      avatarUrl: users.avatarUrl,
      status: matchParticipants.status,
      rating: locationMembers.rating,
      teamId: matchParticipants.teamId,
      rulesConfirmed: matchParticipants.rulesConfirmed,
      paid: matchParticipants.paid,
      rsvpAt: matchParticipants.rsvpAt,
    })
    .from(matchParticipants)
    .innerJoin(users, eq(users.id, matchParticipants.userId))
    .leftJoin(
      locationMembers,
      and(eq(locationMembers.userId, matchParticipants.userId), eq(locationMembers.locationId, locationId))
    )
    .where(eq(matchParticipants.matchId, matchId))
    .orderBy(asc(matchParticipants.rsvpAt)) as unknown as Promise<ParticipantRow[]>;
}

export async function getTeams(matchId: string) {
  return db.select().from(teams).where(eq(teams.matchId, matchId)).orderBy(asc(teams.colorIndex));
}

export async function getGames(matchId: string) {
  return db.select().from(matchGames).where(eq(matchGames.matchId, matchId)).orderBy(asc(matchGames.createdAt));
}

export async function getMatchStandings(matchId: string) {
  const t = await getTeams(matchId);
  const g = await getGames(matchId);
  const standings = computeStandings(
    t.map((x) => x.id),
    g.map((x) => ({ homeTeamId: x.homeTeamId, awayTeamId: x.awayTeamId, homeScore: x.homeScore, awayScore: x.awayScore }))
  );
  const nameById = new Map(t.map((x) => [x.id, x.name]));
  return standings.map((s) => ({ ...s, name: nameById.get(s.teamId) ?? "?" }));
}

/** Simple per-player stats within a location: finished matches played, wins, win rate. */
export async function getPlayerStats(locationId: string, userId: string) {
  // Finished matches where the player was "going" and assigned a team.
  const rows = await db
    .select({
      matchId: matches.id,
      teamId: matchParticipants.teamId,
    })
    .from(matchParticipants)
    .innerJoin(matches, eq(matches.id, matchParticipants.matchId))
    .where(
      and(
        eq(matches.locationId, locationId),
        eq(matchParticipants.userId, userId),
        eq(matchParticipants.status, "going"),
        eq(matches.status, "finished")
      )
    );

  let played = 0;
  let wins = 0;
  for (const r of rows) {
    if (!r.teamId) continue;
    played++;
    const standings = await getMatchStandings(r.matchId);
    if (standings.length > 0 && standings[0].teamId === r.teamId && standings[0].played > 0) wins++;
  }
  const winRate = played > 0 ? Math.round((wins / played) * 100) : 0;
  return { played, wins, winRate };
}

export async function getNotifications(userId: string, limit = 40) {
  try {
    return await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  } catch {
    return [];
  }
}

/** Resilient: returns 0 if the notifications table isn't there yet. */
export async function getUnreadCount(userId: string): Promise<number> {
  try {
    const rows = await db
      .select({ c: sql<number>`count(*)` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
    return Number(rows[0]?.c ?? 0);
  } catch {
    return 0;
  }
}

/** Goals per player for a match (for the admin editor + display). */
export async function getMatchScorers(matchId: string) {
  try {
    return await db
      .select({ userId: matchScorers.userId, name: displayName, goals: matchScorers.goals })
      .from(matchScorers)
      .innerJoin(users, eq(users.id, matchScorers.userId))
      .where(eq(matchScorers.matchId, matchId))
      .orderBy(desc(matchScorers.goals));
  } catch {
    return [];
  }
}

export type PlayerAgg = { played: number; wins: number; goals: number };

/** Aggregate played / wins / goals per player across a location's finished matches. */
export async function getLocationPlayerStats(locationId: string): Promise<Map<string, PlayerAgg>> {
  const stats = new Map<string, PlayerAgg>();
  const bump = (uid: string, fn: (s: PlayerAgg) => void) => {
    const s = stats.get(uid) ?? { played: 0, wins: 0, goals: 0 };
    fn(s);
    stats.set(uid, s);
  };

  const finished = await db
    .select({ id: matches.id })
    .from(matches)
    .where(and(eq(matches.locationId, locationId), eq(matches.status, "finished")));

  for (const fm of finished) {
    const parts = await db
      .select({ userId: matchParticipants.userId, teamId: matchParticipants.teamId })
      .from(matchParticipants)
      .where(and(eq(matchParticipants.matchId, fm.id), eq(matchParticipants.status, "going")));
    const standings = await getMatchStandings(fm.id);
    const winner = standings.length && standings[0].played > 0 ? standings[0].teamId : null;
    for (const p of parts) {
      if (!p.teamId) continue;
      bump(p.userId, (s) => {
        s.played++;
        if (winner && p.teamId === winner) s.wins++;
      });
    }
  }

  // Goals (resilient if the table isn't migrated yet).
  try {
    const goalRows = await db
      .select({ userId: matchScorers.userId, goals: matchScorers.goals })
      .from(matchScorers)
      .innerJoin(matches, eq(matches.id, matchScorers.matchId))
      .where(and(eq(matches.locationId, locationId), eq(matches.status, "finished")));
    for (const g of goalRows) bump(g.userId, (s) => (s.goals += g.goals));
  } catch {
    /* no scorers table yet */
  }

  return stats;
}
