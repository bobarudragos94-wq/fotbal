/**
 * Team balancing.
 *
 * Visual rating is 1..4 where 1 = best player, 4 = weakest.
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
  return 5 - rating; // 1->4, 2->3, 3->2, 4->1
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
 * Build one candidate partition.
 * Shuffle players, sort by strength desc (snake-ish via greedy assignment to
 * the currently weakest team) -> gives balanced totals with randomness from the
 * initial shuffle breaking ties between equal-strength players.
 */
function buildCandidate(
  players: BalancePlayer[],
  numTeams: number,
  rand: () => number
): BalanceResult {
  const withStrength = shuffle(players, rand).map((p) => ({
    userId: p.userId,
    strength: ratingToStrength(p.rating),
  }));
  // Sort strongest first; equal strengths keep shuffled (random) order.
  withStrength.sort((a, b) => b.strength - a.strength);

  const teams: BalancedTeam[] = Array.from({ length: numTeams }, (_, i) => ({
    index: i,
    playerIds: [],
    totalStrength: 0,
  }));
  const capacity = Math.ceil(players.length / numTeams);

  for (const p of withStrength) {
    // Assign to the team with the lowest total that still has room.
    let best = -1;
    for (let i = 0; i < numTeams; i++) {
      if (teams[i].playerIds.length >= capacity) continue;
      if (best === -1 || teams[i].totalStrength < teams[best].totalStrength) best = i;
    }
    if (best === -1) best = 0; // safety
    teams[best].playerIds.push(p.userId);
    teams[best].totalStrength += p.strength;
  }

  const totals = teams.map((t) => t.totalStrength);
  const spread = Math.max(...totals) - Math.min(...totals);
  return { teams, spread };
}

/**
 * Generate balanced teams.
 * @param iterations number of random candidates (default 800)
 * @param rand custom RNG (defaults to Math.random) — pass a seeded one for tests
 */
export function generateBalancedTeams(
  players: BalancePlayer[],
  numTeams: number,
  iterations = 800,
  rand: () => number = Math.random
): BalanceResult {
  if (numTeams < 2) throw new Error("Need at least 2 teams.");
  if (players.length < numTeams) throw new Error("Not enough players for that many teams.");

  let candidates: BalanceResult[] = [];
  let bestSpread = Infinity;

  for (let i = 0; i < iterations; i++) {
    const c = buildCandidate(players, numTeams, rand);
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
