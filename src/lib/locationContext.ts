import "server-only";
import { redirect } from "next/navigation";
import { requirePageUser } from "./page";
import { getLocation } from "./queries";
import { getMembership } from "./permissions";
import type { Location } from "@/db/schema";
import type { AuthUser } from "./auth";

export type LocationContext = {
  user: AuthUser;
  location: Location;
  role: "admin" | "player" | null;
  rating: number | null;
  isAdmin: boolean;
};

/** Loads location + access for the current user, redirecting if not allowed. */
export async function loadLocationContext(locationId: string): Promise<LocationContext> {
  const user = await requirePageUser();
  const location = await getLocation(locationId);
  if (!location) redirect("/app");

  const membership = await getMembership(user.id, locationId);
  const isAdmin = user.isSuperAdmin || membership?.role === "admin";

  // Players must be approved members; super admins can always view.
  if (!membership && !user.isSuperAdmin) redirect("/app");

  return {
    user,
    location,
    role: membership?.role ?? null,
    rating: membership?.rating ?? null,
    isAdmin,
  };
}

/** Same but requires admin rights. */
export async function requireLocationAdmin(locationId: string): Promise<LocationContext> {
  const ctx = await loadLocationContext(locationId);
  if (!ctx.isAdmin) redirect(`/loc/${locationId}`);
  return ctx;
}
