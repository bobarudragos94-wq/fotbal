import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser, type AuthUser } from "./auth";

/** Use in server pages: returns the user or redirects to /login. */
export async function requirePageUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
