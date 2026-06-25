"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import {
  createSession,
  destroySession,
  hashPassword,
  verifyPassword,
  requireUser,
} from "@/lib/auth";
import { newId } from "@/lib/ids";
import { ActionResult, fail, ok, guard } from "@/lib/actionResult";

function str(v: FormDataEntryValue | null): string {
  return (v ?? "").toString().trim();
}

export async function registerAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const name = str(form.get("name"));
  const nickname = str(form.get("nickname"));
  const email = str(form.get("email")).toLowerCase();
  const phone = str(form.get("phone"));
  const password = str(form.get("password"));

  if (name.length < 2) return fail("Please enter your name.");
  if (nickname.length < 2) return fail("Please choose a nickname (at least 2 characters).");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail("Please enter a valid email.");
  if (password.length < 6) return fail("Password must be at least 6 characters.");

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing[0]) return fail("An account with this email already exists.");

  const id = newId();
  await db.insert(users).values({
    id,
    name,
    nickname,
    email,
    phone: phone || null,
    passwordHash: await hashPassword(password),
  });
  await createSession(id);
  redirect("/app");
}

export async function loginAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const email = str(form.get("email")).toLowerCase();
  const password = str(form.get("password"));
  if (!email || !password) return fail("Email and password are required.");

  const rows = await db
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  const user = rows[0];
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return fail("Invalid email or password.");
  }
  await createSession(user.id);
  redirect("/app");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}

export async function updateProfileAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return guard(async () => {
    const user = await requireUser();
    const name = str(form.get("name"));
    const nickname = str(form.get("nickname"));
    const phone = str(form.get("phone"));
    const avatarUrl = str(form.get("avatarUrl"));
    if (name.length < 2) return fail("Please enter your name.");
    if (nickname.length < 2) return fail("Please choose a nickname (at least 2 characters).");
    await db
      .update(users)
      .set({ name, nickname, phone: phone || null, avatarUrl: avatarUrl || null })
      .where(eq(users.id, user.id));
    revalidatePath("/app/profile");
    return ok("Profile updated.");
  });
}
