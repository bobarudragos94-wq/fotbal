import "server-only";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { newId, sessionToken } from "./ids";

const COOKIE = "fgm_session";
const SESSION_DAYS = 30;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function createSession(userId: string): Promise<void> {
  const id = sessionToken();
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400;
  await db.insert(sessions).values({ id, userId, expiresAt });
  cookies().set(COOKIE, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
}

export async function destroySession(): Promise<void> {
  const token = cookies().get(COOKIE)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.id, token));
  }
  cookies().delete(COOKIE);
}

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  isSuperAdmin: boolean;
};

/** Returns the current user or null. Cleans up expired sessions. */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      avatarUrl: users.avatarUrl,
      isSuperAdmin: users.isSuperAdmin,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, token))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  if (row.expiresAt < Math.floor(Date.now() / 1000)) {
    await db.delete(sessions).where(eq(sessions.id, token));
    return null;
  }

  const { expiresAt, ...user } = row;
  return user;
}

/** Throws a redirect-friendly sentinel if not authenticated. Use in pages via requireUser. */
export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}

export { COOKIE };
