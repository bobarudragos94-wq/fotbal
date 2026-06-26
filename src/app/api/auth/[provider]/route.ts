import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { isProvider, providerConfigured, buildAuthUrl, randomState } from "@/lib/oauth";

export const dynamic = "force-dynamic";

function getOrigin(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const h = headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

export async function GET(_req: Request, { params }: { params: { provider: string } }) {
  const provider = params.provider;
  const origin = getOrigin();
  if (!isProvider(provider) || !providerConfigured(provider)) {
    return NextResponse.redirect(new URL("/login?error=oauth_unavailable", origin));
  }

  const redirectUri = `${origin}/api/auth/${provider}/callback`;
  const state = randomState();

  const jar = cookies();
  const secure = process.env.NODE_ENV === "production";
  jar.set("oauth_state", state, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 600 });
  jar.set("oauth_provider", provider, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 600 });

  return NextResponse.redirect(buildAuthUrl(provider, redirectUri, state));
}
