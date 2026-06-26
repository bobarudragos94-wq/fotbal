import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { isProvider, exchangeCode, findOrCreateOAuthUser } from "@/lib/oauth";
import { createSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

function getOrigin(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const h = headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

export async function GET(req: Request, { params }: { params: { provider: string } }) {
  const provider = params.provider;
  const origin = getOrigin();
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const jar = cookies();
  const storedState = jar.get("oauth_state")?.value;
  jar.delete("oauth_state");
  jar.delete("oauth_provider");

  if (!isProvider(provider) || !code || !state || !storedState || state !== storedState) {
    return NextResponse.redirect(new URL("/login?error=oauth_failed", origin));
  }

  try {
    const redirectUri = `${origin}/api/auth/${provider}/callback`;
    const profile = await exchangeCode(provider, code, redirectUri);
    if (!profile.email) {
      return NextResponse.redirect(new URL("/login?error=oauth_no_email", origin));
    }
    const userId = await findOrCreateOAuthUser(profile);
    await createSession(userId);
    return NextResponse.redirect(new URL("/app", origin));
  } catch {
    return NextResponse.redirect(new URL("/login?error=oauth_failed", origin));
  }
}
