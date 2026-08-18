export const RATING_MIN = 1;
export const RATING_MAX = 6;

/**
 * Aggregate community rating votes (each a whole 1..6) into a proposed rating.
 * `mean` is the value the admin confirms — it is kept fractional on purpose
 * (a player voted 3,3,4 is a 3.33, not a 3), so team balancing has the real
 * numbers to work with. `rounded` is only used for labels like "Bun".
 */
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
  const rounded = Math.min(RATING_MAX, Math.max(RATING_MIN, Math.round(mean)));
  return { mean: normalizeRating(mean), median, rounded, count: votes.length };
}

/** Clamp into 1..6 and keep at most 2 decimals — the stored form of a rating. */
export function normalizeRating(value: number): number {
  const clamped = Math.min(RATING_MAX, Math.max(RATING_MIN, value));
  return Math.round(clamped * 100) / 100;
}

/** Display form: "3", "3.5", "2.33" — no trailing zeros. */
export function formatRating(value: number): string {
  return String(Math.round(value * 100) / 100);
}

export const RATING_LABELS: Record<number, string> = {
  1: "Top",
  2: "Foarte bun",
  3: "Bun",
  4: "Mediu",
  5: "Slab",
  6: "Începător",
};

/** Nearest label for a fractional rating (3.4 -> "Bun"). */
export function ratingLabel(value: number): string {
  return RATING_LABELS[Math.min(RATING_MAX, Math.max(RATING_MIN, Math.round(value)))];
}
