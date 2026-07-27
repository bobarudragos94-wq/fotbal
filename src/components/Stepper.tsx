"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Number field with −/+ buttons, for goal counts on a phone.
 * Still typeable, and it resets with the surrounding form (`form.reset()`).
 */
export function Stepper({
  name,
  defaultValue = 0,
  min = 0,
  max = 99,
  label,
}: {
  name: string;
  defaultValue?: number;
  min?: number;
  max?: number;
  /** Screen-reader context, e.g. the player or team name. */
  label?: string;
}) {
  const [value, setValue] = useState(String(defaultValue));
  const ref = useRef<HTMLInputElement>(null);
  const num = Number(value) || 0;
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const step = (delta: number) => setValue(String(clamp(num + delta)));

  // `resetOnSuccess` forms call form.reset(), which can't clear a controlled input.
  useEffect(() => {
    const form = ref.current?.form;
    if (!form) return;
    const onReset = () => setValue(String(defaultValue));
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, [defaultValue]);

  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        className="btn-ghost h-11 min-h-0 w-11 px-0 text-xl font-bold"
        onClick={() => step(-1)}
        disabled={num <= min}
        aria-label={label ? `Scade: ${label}` : "Scade"}
      >
        −
      </button>
      <input
        ref={ref}
        name={name}
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/\D/g, "").slice(0, 2))}
        onBlur={() => setValue(String(clamp(num)))}
        type="text"
        inputMode="numeric"
        aria-label={label}
        className="input h-11 min-h-0 w-12 px-0 text-center text-base font-bold"
      />
      <button
        type="button"
        className="btn-ghost h-11 min-h-0 w-11 px-0 text-xl font-bold"
        onClick={() => step(1)}
        disabled={num >= max}
        aria-label={label ? `Adaugă: ${label}` : "Adaugă"}
      >
        +
      </button>
    </div>
  );
}
