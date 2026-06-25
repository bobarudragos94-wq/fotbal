"use client";

import { useFormState, useFormStatus } from "react-dom";
import type { ReactNode } from "react";
import type { ActionResult } from "@/lib/actionResult";

type Action = (prev: ActionResult | null, form: FormData) => Promise<ActionResult>;

export function ActionForm({
  action,
  children,
  className = "",
  resetOnSuccess = false,
}: {
  action: Action;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction] = useFormState(action, null);
  return (
    <form
      action={formAction}
      className={className}
      // Reset native inputs after a successful create/add.
      ref={(el) => {
        if (resetOnSuccess && el && state?.ok) el.reset();
      }}
    >
      {children}
      {state && !state.ok && (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300" role="alert">
          {state.error}
        </p>
      )}
      {state && state.ok && state.message && (
        <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" role="status">
          {state.message}
        </p>
      )}
    </form>
  );
}

export function SubmitButton({
  children,
  className = "btn-primary w-full",
  pendingText,
}: {
  children: ReactNode;
  className?: string;
  pendingText?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending}>
      {pending ? pendingText ?? "Working…" : children}
    </button>
  );
}

/** Tiny inline form for single-button actions (no message UI). */
export function InlineAction({
  action,
  hidden,
  children,
  className = "btn-ghost btn-sm",
  confirm,
}: {
  action: Action;
  hidden: Record<string, string>;
  children: ReactNode;
  className?: string;
  confirm?: string;
}) {
  const [, formAction] = useFormState(action, null);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <SubmitButton className={className}>{children}</SubmitButton>
    </form>
  );
}
