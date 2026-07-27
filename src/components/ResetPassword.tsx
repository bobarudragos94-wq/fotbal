"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import type { ActionResult } from "@/lib/actionResult";
import { SubmitButton } from "./Form";
import { emitToast } from "./Toast";

type Action = (prev: ActionResult | null, form: FormData) => Promise<ActionResult>;

/**
 * Super-admin control: reset one user's password.
 * Leaving the field empty generates a temporary password, shown once so the
 * admin can pass it on (WhatsApp, in person). Nothing is emailed.
 */
export function ResetPassword({
  action,
  userId,
  userName,
}: {
  action: Action;
  userId: string;
  userName: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useFormState(action, null);
  const password = state?.ok ? state.data?.password : undefined;

  if (password) {
    return (
      <div className="mt-3 rounded-xl border border-emerald-300 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-950/40">
        <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
          Parolă nouă pentru {userName}
        </p>
        <p className="mt-0.5 text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
          Se afișează o singură dată — trimite-o acum. {userName} a fost deconectat de pe toate dispozitivele.
        </p>
        <div className="mt-2 flex items-center gap-2">
          <code className="flex-1 select-all rounded-lg bg-white px-3 py-2 font-mono text-sm tracking-wider dark:bg-slate-900">
            {password}
          </code>
          <button type="button" className="btn-ghost btn-sm" onClick={() => copy(password)}>
            Copiază
          </button>
        </div>
        <button
          type="button"
          className="btn-ghost btn-sm mt-2 w-full"
          onClick={() => window.location.reload()}
        >
          Gata
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button type="button" className="btn-ghost btn-sm mt-3 w-full" onClick={() => setOpen(true)}>
        Resetează parola
      </button>
    );
  }

  return (
    <form action={formAction} className="mt-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
      <input type="hidden" name="userId" value={userId} />
      <label className="label" htmlFor={`pw-${userId}`}>
        Parolă nouă pentru {userName}
      </label>
      <input
        id={`pw-${userId}`}
        name="password"
        type="text"
        autoComplete="off"
        minLength={6}
        className="input"
        placeholder="Lasă gol pentru una generată"
      />
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button type="button" className="btn-ghost btn-sm" onClick={() => setOpen(false)}>
          Anulează
        </button>
        <SubmitButton className="btn-primary btn-sm" pendingText="Se resetează…">
          Resetează
        </SubmitButton>
      </div>
      {state && !state.ok && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}

function copy(text: string) {
  // navigator.clipboard is undefined on insecure origins — fall back to a hint.
  const done = navigator.clipboard?.writeText(text);
  if (!done) return emitToast("Selectează și copiază parola manual.", "error");
  done.then(
    () => emitToast("Parolă copiată."),
    () => emitToast("Selectează și copiază parola manual.", "error")
  );
}
