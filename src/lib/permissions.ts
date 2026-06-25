import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { locationMembers, matches } from "@/db/schema";
import type { AuthUser } from "./auth";

export class PermissionError extends Error {
  constructor(msg = "Forbidden") {
    super(msg);
    this.name = "PermissionError";
  }
}

export type Membership = {
  role: "admin" | "player";
  rating: number | null;
};

/** Membership of a user in a location, or null. */
export async function getMembership(
  userId: string,
  locationId: string
): Promise<Membership | null> {
  const rows = await db
    .select({ role: locationMembers.role, rating: locationMembers.rating })
    .from(locationMembers)
    .where(and(eq(locationMembers.userId, userId), eq(locationMembers.locationId, locationId)))
    .limit(1);
  return rows[0] ?? null;
}

/** True if user is super admin OR an admin of this location. */
export async function canAdminLocation(user: AuthUser, locationId: string): Promise<boolean> {
  if (user.isSuperAdmin) return true;
  const m = await getMembership(user.id, locationId);
  return m?.role === "admin";
}

/** True if user can view a location's data (member of any role, or super admin). */
export async function canViewLocation(user: AuthUser, locationId: string): Promise<boolean> {
  if (user.isSuperAdmin) return true;
  return (await getMembership(user.id, locationId)) !== null;
}

/** Assert admin rights or throw. */
export async function assertLocationAdmin(user: AuthUser, locationId: string): Promise<void> {
  if (!(await canAdminLocation(user, locationId))) {
    throw new PermissionError("You are not an admin of this location.");
  }
}

/** Assert the user can view a location or throw. */
export async function assertLocationMember(user: AuthUser, locationId: string): Promise<void> {
  if (!(await canViewLocation(user, locationId))) {
    throw new PermissionError("You are not a member of this location.");
  }
}

export function assertSuperAdmin(user: AuthUser): void {
  if (!user.isSuperAdmin) throw new PermissionError("Super admin only.");
}

/** Resolve the location a match belongs to (for scoping checks). */
export async function getMatchLocationId(matchId: string): Promise<string | null> {
  const rows = await db
    .select({ locationId: matches.locationId })
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);
  return rows[0]?.locationId ?? null;
}
