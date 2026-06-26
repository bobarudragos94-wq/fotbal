import "server-only";
import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { users } from "@/db/schema";
import { newId } from "./ids";

export type Provider = "google" | "facebook";

export function isProvider(p: string): p is Provider {
  return p === "google" || p === "facebook";
}

export function providerConfigured(p: Provider): boolean {
  return p === "google"
    ? !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
    : !!(process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET);
}

export function randomState(): string {
  return randomBytes(16).toString("base64url");
}

export function buildAuthUrl(p: Provider, redirectUri: string, state: string): string {
  if (p === "google") {
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
      access_type: "online",
      prompt: "select_account",
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }
  // facebook
  const params = new URLSearchParams({
    client_id: process.env.FACEBOOK_CLIENT_ID!,
    redirect_uri: redirectUri,
    state,
    response_type: "code",
    scope: "email,public_profile",
  });
  return `https://www.facebook.com/v19.0/dialog/oauth?${params}`;
}

export type OAuthProfile = { email: string | null; name: string | null; picture: string | null };

/** Exchange the authorization code for the user's profile. */
export async function exchangeCode(p: Provider, code: string, redirectUri: string): Promise<OAuthProfile> {
  if (p === "google") {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) throw new Error("Google token exchange failed.");
    const { access_token } = (await tokenRes.json()) as { access_token: string };
    const infoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!infoRes.ok) throw new Error("Google profile fetch failed.");
    const info = (await infoRes.json()) as { email?: string; name?: string; picture?: string };
    return { email: info.email ?? null, name: info.name ?? null, picture: info.picture ?? null };
  }

  // facebook
  const tokenUrl = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
  tokenUrl.searchParams.set("client_id", process.env.FACEBOOK_CLIENT_ID!);
  tokenUrl.searchParams.set("client_secret", process.env.FACEBOOK_CLIENT_SECRET!);
  tokenUrl.searchParams.set("redirect_uri", redirectUri);
  tokenUrl.searchParams.set("code", code);
  const tokenRes = await fetch(tokenUrl);
  if (!tokenRes.ok) throw new Error("Facebook token exchange failed.");
  const { access_token } = (await tokenRes.json()) as { access_token: string };
  const meUrl = new URL("https://graph.facebook.com/me");
  meUrl.searchParams.set("fields", "id,name,email,picture.type(large)");
  meUrl.searchParams.set("access_token", access_token);
  const meRes = await fetch(meUrl);
  if (!meRes.ok) throw new Error("Facebook profile fetch failed.");
  const me = (await meRes.json()) as { name?: string; email?: string; picture?: { data?: { url?: string } } };
  return { email: me.email ?? null, name: me.name ?? null, picture: me.picture?.data?.url ?? null };
}

/** Find a user by email, or create one. OAuth accounts get a random unusable password. */
export async function findOrCreateOAuthUser(profile: OAuthProfile): Promise<string> {
  const email = (profile.email ?? "").toLowerCase().trim();
  if (!email) throw new Error("NO_EMAIL");

  const existing = await db.select({ id: users.id, avatarUrl: users.avatarUrl }).from(users).where(eq(users.email, email)).limit(1);
  if (existing[0]) {
    // Backfill avatar from the provider if the account doesn't have one.
    if (!existing[0].avatarUrl && profile.picture) {
      await db.update(users).set({ avatarUrl: profile.picture }).where(eq(users.id, existing[0].id));
    }
    return existing[0].id;
  }

  const id = newId();
  const name = profile.name?.trim() || email.split("@")[0];
  const nickname = name.split(/\s+/)[0];
  const passwordHash = await bcrypt.hash(randomBytes(24).toString("hex"), 10);
  await db.insert(users).values({
    id,
    name,
    nickname,
    email,
    avatarUrl: profile.picture ?? null,
    passwordHash,
  });
  return id;
}
