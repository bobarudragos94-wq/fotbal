import "server-only";
import { and, eq, like } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { users, locationMembers } from "@/db/schema";
import { newId } from "./ids";

/**
 * Guests: placeholders for friends someone brings who aren't in the app. An
 * admin adds one by rating (1..6) and it joins the match like any player, team
 * balancing included. A rating can be added as many times as needed — each tap
 * reuses a free guest of that rating or mints a new one.
 *
 * They are ordinary user rows (match_participants needs a real user), marked by
 * this email suffix — the same trick the demo players use. Their password is
 * random: nobody can sign in as a guest.
 */
export const GUEST_EMAIL_SUFFIX = "@invitat.local";
export const GUEST_RATINGS = [1, 2, 3, 4, 5, 6];

export function isGuestEmail(email: string): boolean {
  return email.endsWith(GUEST_EMAIL_SUFFIX);
}

export type Guest = {
  userId: string;
  name: string;
  /** Current rating — an admin may retune a guest from Admin → Jucători. */
  rating: number | null;
};

/** Every guest row of a location (read-only). */
export async function getLocationGuests(locationId: string): Promise<Guest[]> {
  return db
    .select({ userId: users.id, name: users.name, rating: locationMembers.rating })
    .from(locationMembers)
    .innerJoin(users, eq(users.id, locationMembers.userId))
    .where(and(eq(locationMembers.locationId, locationId), like(users.email, `%${GUEST_EMAIL_SUFFIX}`)));
}

/** True if this user is a guest placeholder of that location. */
export async function isLocationGuest(userId: string, locationId: string): Promise<boolean> {
  const rows = await db
    .select({ email: users.email })
    .from(locationMembers)
    .innerJoin(users, eq(users.id, locationMembers.userId))
    .where(and(eq(locationMembers.locationId, locationId), eq(locationMembers.userId, userId)))
    .limit(1);
  return rows[0] != null && isGuestEmail(rows[0].email);
}

/**
 * A guest of `rating` that is free to use — not among `taken` (the userIds
 * already on the match). Mints a new one when every existing guest of that
 * rating is busy, so several friends of the same level can play together.
 */
export async function takeGuestOfRating(
  locationId: string,
  rating: number,
  taken: Set<string>
): Promise<Guest> {
  const guests = await getLocationGuests(locationId);
  const free = guests.find((g) => g.rating === rating && !taken.has(g.userId));
  if (free) return free;

  const nth = guests.filter((g) => g.rating === rating).length + 1;
  const name = nth === 1 ? `Invitat ${rating}` : `Invitat ${rating} (${nth})`;
  const userId = newId();
  await db.insert(users).values({
    id: userId,
    name,
    nickname: name,
    email: `invitat-${newId()}${GUEST_EMAIL_SUFFIX}`,
    // One unusable password: guest accounts are never signed into.
    passwordHash: await bcrypt.hash(newId() + newId(), 10),
  });
  await db.insert(locationMembers).values({
    id: newId(),
    locationId,
    userId,
    role: "player",
    rating,
  });
  return { userId, name, rating };
}
