"use client";

import { useFormState } from "react-dom";
import type { ActionResult } from "@/lib/actionResult";

type Action = (prev: ActionResult | null, form: FormData) => Promise<ActionResult>;

/** A <select> that submits its form on change (for quick admin edits). */
export function SelectSubmit({
  action,
  name,
  value,
  hidden,
  options,
  className = "input min-h-0 h-9 py-0 text-sm w-auto",
}: {
  action: Action;
  name: string;
  value: string;
  hidden: Record<string, string>;
  options: { value: string; label: string }[];
  className?: string;
}) {
  const [, formAction] = useFormState(action, null);
  return (
    <form action={formAction}>
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <select
        name={name}
        defaultValue={value}
        className={className}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </form>
  );
}
