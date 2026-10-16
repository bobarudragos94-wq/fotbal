import "server-only";
import { and, eq, like } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { users, locationMembers } from "@/db/schema";
import { newId } from "./ids";

/**
 * Guest slots: placeholders for a friend someone brings along who isn't in the
 * app. Six per location, one per rating 1..6 — an admin drops the one that fits
 * onto a match list, so the guest counts in the squad and in team balancing.
 *
 * They are ordinary user rows (match_participants needs a real user), marked by
 * this email suffix — the same trick the demo players use. Their password is
 * random: nobody can sign in as a guest.
 */
export const GUEST_EMAIL_SUFFIX = "@invitat.local";
export const GUEST_SLOTS = [1, 2, 3, 4, 5, 6];

export function isGuestEmail(email: string): boolean {
  return email.endsWith(GUEST_EMAIL_SUFFIX);
}

/** Slot n of a location always owns this address, so slots survive renames. */
function guestEmail(locationId: string, slot: number): string {
  return `invitat-${slot}-${locationId}${GUEST_EMAIL_SUFFIX}`;
}

export type GuestSlot = {
  slot: number;
  userId: string;
  /** Current rating of the slot — an admin may retune it from Jucători. */
  rating: number | null;
};

function slotOf(email: string): number | null {
  const m = /^invitat-(\d)-/.exec(email);
  const n = m ? Number(m[1]) : NaN;
  return GUEST_SLOTS.includes(n) ? n : null;
}

/** Read-only: the guest slots that already exist in this location. */
export async function getLocationGuests(locationId: string): Promise<GuestSlot[]> {
  const rows = await db
    .select({ userId: users.id, email: users.email, rating: locationMembers.rating })
    .from(locationMembers)
    .innerJoin(users, eq(users.id, locationMembers.userId))
    .where(and(eq(locationMembers.locationId, locationId), like(users.email, `%${GUEST_EMAIL_SUFFIX}`)));

  return rows
    .map((r) => ({ slot: slotOf(r.email), userId: r.userId, rating: r.rating }))
    .filter((g): g is GuestSlot => g.slot != null)
    .sort((a, b) => a.slot - b.slot);
}

/**
 * The six guest slots, creating any that are missing. Called from admin actions
 * only, so a location grows its guests the first time an admin uses one.
 */
export async function ensureLocationGuests(locationId: string): Promise<GuestSlot[]> {
  const existing = await getLocationGuests(locationId);
  const have = new Map(existing.map((g) => [g.slot, g]));
  const missing = GUEST_SLOTS.filter((s) => !have.has(s));
  if (missing.length === 0) return existing;

  // One unusable password for every guest row: these accounts are never signed into.
  const hash = await bcrypt.hash(newId() + newId(), 10);
  for (const slot of missing) {
    const userId = newId();
    await db.insert(users).values({
      id: userId,
      name: `Invitat ${slot}`,
      nickname: `Invitat ${slot}`,
      email: guestEmail(locationId, slot),
      passwordHash: hash,
    });
    await db.insert(locationMembers).values({
      id: newId(),
      locationId,
      userId,
      role: "player",
      rating: slot,
    });
    have.set(slot, { slot, userId, rating: slot });
  }
  return GUEST_SLOTS.map((s) => have.get(s)!).filter(Boolean);
}
