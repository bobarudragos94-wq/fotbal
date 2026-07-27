import "server-only";
import { cookies } from "next/headers";
import { and, eq, ne } from "drizzle-orm";
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

/** The session token in the current request's cookie, if any. */
export function currentSessionToken(): string | undefined {
  return cookies().get(COOKIE)?.value;
}

/**
 * Log a user out of every device. Pass `exceptToken` to keep one session alive —
 * used when an admin resets their own password and shouldn't be kicked out.
 */
export async function revokeSessions(userId: string, exceptToken?: string): Promise<void> {
  await db
    .delete(sessions)
    .where(
      exceptToken
        ? and(eq(sessions.userId, userId), ne(sessions.id, exceptToken))
        : eq(sessions.userId, userId)
    );
}

export type AuthUser = {
  id: string;
  name: string;
  nickname: string | null;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  isSuperAdmin: boolean;
};

/** Name to show in the UI: nickname if set, otherwise real name. */
export function display(user: { nickname: string | null; name: string }): string {
  return user.nickname && user.nickname.trim() ? user.nickname : user.name;
}

/** Returns the current user or null. Cleans up expired sessions. */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      nickname: users.nickname,
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
