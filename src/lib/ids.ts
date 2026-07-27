import { randomBytes, randomUUID } from "crypto";

export function newId(): string {
  return randomUUID();
}

/** Short, human-friendly, unambiguous invite code (no 0/O/1/I). */
export function inviteCode(len = 6): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

export function sessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Temporary password an admin can dictate over the phone or paste in WhatsApp:
 * 3 groups of 4 unambiguous characters, e.g. "K7P2-M9RT-4XWQ".
 */
export function tempPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(12);
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]);
  return [chars.slice(0, 4), chars.slice(4, 8), chars.slice(8, 12)]
    .map((g) => g.join(""))
    .join("-");
}
