/**
 * Team balancing.
 *
 * Visual rating is 1..6 where 1 = best player, 6 = weakest, and it is
 * **fractional** — a player the group voted 3,3,4 is a 3.33, not a 3.
 * For balancing we invert to "strength" where higher = better:
 *   rating 1   -> strength 6
 *   rating 3.5 -> strength 3.5
 *   rating 6   -> strength 1
 *
 * Strategy: controlled randomization + local search. Generate many random valid
 * partitions, improve each by swapping players between the strongest and weakest
 * team while that narrows the gap, score by the spread (max total - min total),
 * keep the best few and pick one at random so "Regenerate" yields a
 * fresh-but-fair set.
 */

/** Floats: treat differences below this as equal. */
const EPS = 1e-9;

export function ratingToStrength(rating: number): number {
  return 7 - rating; // 1->6, 3.5->3.5, ... 6->1 (1 = best)
}

/** Sums of fractional strengths need trimming, or totals drift to 12.299999999. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type BalancePlayer = {
  userId: string;
  rating: number; // 1..6, may be fractional
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

function spreadOf(teams: BalancedTeam[]): number {
  const totals = teams.map((t) => t.totalStrength);
  return Math.max(...totals) - Math.min(...totals);
}

/**
 * Local search: repeatedly swap one player from the strongest team with one from
 * the weakest, whenever that narrows the gap between them. Only those two totals
 * change and both move inward, so the overall spread never gets worse. This is
 * what makes fractional ratings pay off — the greedy pass alone leaves gaps that
 * a single swap of, say, a 3.5 for a 3 can close.
 */
function refine(teams: BalancedTeam[], strength: Map<string, number>, maxRounds = 60): void {
  for (let round = 0; round < maxRounds; round++) {
    let hi = 0;
    let lo = 0;
    teams.forEach((t, i) => {
      if (t.totalStrength > teams[hi].totalStrength) hi = i;
      if (t.totalStrength < teams[lo].totalStrength) lo = i;
    });
    const gap = teams[hi].totalStrength - teams[lo].totalStrength;
    if (gap <= EPS) return;

    let best: { a: string; b: string; gap: number } | null = null;
    for (const a of teams[hi].playerIds) {
      for (const b of teams[lo].playerIds) {
        const delta = strength.get(a)! - strength.get(b)!;
        if (delta <= EPS) continue; // only move strength from the strong team down
        const newGap = Math.abs(gap - 2 * delta);
        if (newGap < gap - EPS && (best === null || newGap < best.gap)) best = { a, b, gap: newGap };
      }
    }
    if (!best) return; // no improving swap left

    const { a, b } = best;
    teams[hi].playerIds[teams[hi].playerIds.indexOf(a)] = b;
    teams[lo].playerIds[teams[lo].playerIds.indexOf(b)] = a;
    const delta = strength.get(a)! - strength.get(b)!;
    teams[hi].totalStrength = round2(teams[hi].totalStrength - delta);
    teams[lo].totalStrength = round2(teams[lo].totalStrength + delta);
  }
}

/**
 * Build one candidate partition with EQUAL team sizes.
 * Randomly pick which `teamSize * numTeams` players play, the rest are leftovers
 * (reserves with no team). Within the playing pool, assign strongest-first to the
 * currently weakest team, then refine by swapping; the initial shuffle randomizes
 * both the leftover selection and ties between equal-strength players.
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

  const strength = new Map(pool.map((p) => [p.userId, ratingToStrength(p.rating)]));
  const withStrength = pool
    .map((p) => ({ userId: p.userId, strength: strength.get(p.userId)! }))
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
    teams[best].totalStrength = round2(teams[best].totalStrength + p.strength);
  }

  refine(teams, strength);

  return { teams, leftoverIds, spread: round2(spreadOf(teams)) };
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
    if (c.spread < bestSpread - EPS) {
      bestSpread = c.spread;
      candidates = [c];
    } else if (Math.abs(c.spread - bestSpread) <= EPS) {
      // collect equally-good variants for random tie-break (max 25 kept)
      if (candidates.length < 25) candidates.push(c);
    }
  }

  // Pick a random variant among the best -> controlled randomization.
  return candidates[Math.floor(rand() * candidates.length)] ?? candidates[0];
}

export const TEAM_NAMES = ["A", "B", "C", "D", "E", "F"];

/** "Team A" -> "A", for tight spots like the per-player move dropdowns. */
export function shortTeamName(name: string): string {
  return name.replace(/^team\s+/i, "");
}
