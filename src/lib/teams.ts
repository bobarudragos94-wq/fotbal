/**
 * Team balancing.
 *
 * Visual rating is 1..6 where 1 = best player, 6 = weakest.
 * For balancing we invert to "strength" where higher = better:
 *   rating 1 -> strength 4
 *   rating 2 -> strength 3
 *   rating 3 -> strength 2
 *   rating 4 -> strength 1
 *
 * Strategy: controlled randomization. Generate many random valid partitions,
 * score each by the spread (max team strength - min team strength), keep the
 * best few, and pick one at random so "Regenerate" yields a fresh-but-fair set.
 */

export function ratingToStrength(rating: number): number {
  return 7 - rating; // 1->6, 2->5, ... 6->1 (1 = best)
}

export type BalancePlayer = {
  userId: string;
  rating: number; // 1..4
};

export type BalancedTeam = {
  index: number;
  playerIds: string[];
  totalStrength: number;
};

export type BalanceResult = {
  teams: BalancedTeam[];
  leftoverIds: string[]; // confirmed players who didn't fit into the equal teams
  spread: number; // strongest - weakest total strength
};

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Build one candidate partition with EQUAL team sizes.
 * Randomly pick which `teamSize * numTeams` players play, the rest are leftovers
 * (reserves with no team). Within the playing pool, assign strongest-first to the
 * currently weakest team -> balanced totals; the initial shuffle randomizes both
 * the leftover selection and ties between equal-strength players.
 */
function buildCandidate(
  players: BalancePlayer[],
  numTeams: number,
  teamSize: number,
  rand: () => number
): BalanceResult {
  const shuffled = shuffle(players, rand);
  const playingCount = teamSize * numTeams;
  const pool = shuffled.slice(0, playingCount);
  const leftoverIds = shuffled.slice(playingCount).map((p) => p.userId);

  const withStrength = pool
    .map((p) => ({ userId: p.userId, strength: ratingToStrength(p.rating) }))
    .sort((a, b) => b.strength - a.strength); // strongest first; equal -> shuffled order

  const teams: BalancedTeam[] = Array.from({ length: numTeams }, (_, i) => ({
    index: i,
    playerIds: [],
    totalStrength: 0,
  }));

  for (const p of withStrength) {
    // Assign to the team with the lowest total that still has room.
    let best = -1;
    for (let i = 0; i < numTeams; i++) {
      if (teams[i].playerIds.length >= teamSize) continue;
      if (best === -1 || teams[i].totalStrength < teams[best].totalStrength) best = i;
    }
    if (best === -1) best = 0; // safety
    teams[best].playerIds.push(p.userId);
    teams[best].totalStrength += p.strength;
  }

  const totals = teams.map((t) => t.totalStrength);
  const spread = Math.max(...totals) - Math.min(...totals);
  return { teams, leftoverIds, spread };
}

/**
 * Generate balanced, EQUAL-sized teams.
 *
 * @param teamSize players per team. Defaults to floor(N / numTeams) so teams come
 *   out equal and any extras become leftovers. Pass the match's playersPerTeam to
 *   cap team size (the function still clamps to what the squad allows).
 * @param iterations number of random candidates (default 800)
 * @param rand custom RNG (defaults to Math.random) — pass a seeded one for tests
 */
export function generateBalancedTeams(
  players: BalancePlayer[],
  numTeams: number,
  teamSize?: number,
  iterations = 800,
  rand: () => number = Math.random
): BalanceResult {
  if (numTeams < 2) throw new Error("Need at least 2 teams.");
  if (players.length < numTeams) throw new Error("Not enough players for that many teams.");

  // Equal teams: never more than floor(N / numTeams) per team.
  const maxEqual = Math.floor(players.length / numTeams);
  const ts = Math.max(1, Math.min(teamSize ?? maxEqual, maxEqual));

  let candidates: BalanceResult[] = [];
  let bestSpread = Infinity;

  for (let i = 0; i < iterations; i++) {
    const c = buildCandidate(players, numTeams, ts, rand);
    if (c.spread < bestSpread) {
      bestSpread = c.spread;
      candidates = [c];
    } else if (c.spread === bestSpread) {
      // collect equally-good variants for random tie-break (max 25 kept)
      if (candidates.length < 25) candidates.push(c);
    }
  }

  // Pick a random variant among the best -> controlled randomization.
  return candidates[Math.floor(rand() * candidates.length)] ?? candidates[0];
}

export const TEAM_NAMES = ["A", "B", "C", "D", "E", "F"];
