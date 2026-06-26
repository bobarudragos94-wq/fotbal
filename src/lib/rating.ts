/** Aggregate community rating votes (each 1..4) into a proposed rating. */
export function proposeRating(votes: number[]): {
  mean: number | null;
  median: number | null;
  rounded: number | null;
  count: number;
} {
  if (votes.length === 0) return { mean: null, median: null, rounded: null, count: 0 };
  const sorted = [...votes].sort((a, b) => a - b);
  const mean = votes.reduce((s, v) => s + v, 0) / votes.length;
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  const rounded = Math.min(4, Math.max(1, Math.round(mean)));
  return { mean: Math.round(mean * 100) / 100, median, rounded, count: votes.length };
}

export const RATING_LABELS: Record<number, string> = {
  1: "Top",
  2: "Bun",
  3: "Mediu",
  4: "Începător",
};
