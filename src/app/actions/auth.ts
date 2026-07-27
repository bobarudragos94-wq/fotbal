"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, auditLogs } from "@/db/schema";
import {
  createSession,
  destroySession,
  hashPassword,
  verifyPassword,
  requireUser,
  revokeSessions,
  currentSessionToken,
  display,
} from "@/lib/auth";
import { assertSuperAdmin } from "@/lib/permissions";
import { newId, tempPassword } from "@/lib/ids";
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

  if (name.length < 2) return fail("Introdu numele.");
  if (nickname.length < 2) return fail("Alege un nickname (minim 2 caractere).");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail("Introdu un email valid.");
  if (password.length < 6) return fail("Parola trebuie să aibă minim 6 caractere.");

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing[0]) return fail("Există deja un cont cu acest email.");

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
  if (!email || !password) return fail("Email și parolă sunt obligatorii.");

  const rows = await db
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  const user = rows[0];
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return fail("Email sau parolă greșite.");
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
    if (name.length < 2) return fail("Introdu numele.");
    if (nickname.length < 2) return fail("Alege un nickname (minim 2 caractere).");
    await db
      .update(users)
      .set({ name, nickname, phone: phone || null, avatarUrl: avatarUrl || null })
      .where(eq(users.id, user.id));
    revalidatePath("/app/profile");
    return ok("Profil actualizat.");
  });
}

/**
 * Super admin resets any user's password.
 * Leave the `password` field empty to get a generated temporary one.
 * The target is logged out of all devices (the actor keeps the current session
 * when resetting their own password).
 */
export async function superResetPasswordAction(
  _prev: ActionResult | null,
  form: FormData
): Promise<ActionResult> {
  return guard(async () => {
    const actor = await requireUser();
    assertSuperAdmin(actor);

    const userId = str(form.get("userId"));
    const custom = str(form.get("password"));
    if (!userId) return fail("Lipsește utilizatorul.");
    if (custom && custom.length < 6) return fail("Parola trebuie să aibă minim 6 caractere.");

    const rows = await db
      .select({ id: users.id, name: users.name, nickname: users.nickname, email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const target = rows[0];
    if (!target) return fail("Utilizatorul nu există.");

    const password = custom || tempPassword();
    await db
      .update(users)
      .set({ passwordHash: await hashPassword(password) })
      .where(eq(users.id, target.id));

    // Any stolen/stale session for this user dies with the old password.
    await revokeSessions(target.id, target.id === actor.id ? currentSessionToken() : undefined);

    await db.insert(auditLogs).values({
      id: newId(),
      locationId: null,
      actorUserId: actor.id,
      action: "super.reset_password",
      detail: `${target.email} (${custom ? "manuală" : "generată"})`,
    });

    revalidatePath("/super/users");
    return ok(`Parolă nouă pentru ${display(target)}.`, { password, email: target.email });
  });
}
