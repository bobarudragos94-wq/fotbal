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
