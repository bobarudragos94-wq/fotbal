export type ActionResult =
  | { ok: true; message?: string; data?: Record<string, string> }
  | { ok: false; error: string };

/** `data` carries small extras back to the client (e.g. a generated password). */
export function ok(message?: string, data?: Record<string, string>): ActionResult {
  return { ok: true, message, data };
}
export function fail(error: string): ActionResult {
  return { ok: false, error };
}

/** Wrap an action body, converting thrown errors into a friendly ActionResult. */
export async function guard(fn: () => Promise<ActionResult | void>): Promise<ActionResult> {
  try {
    const r = await fn();
    return r ?? ok();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Something went wrong.";
    return fail(msg);
  }
}
