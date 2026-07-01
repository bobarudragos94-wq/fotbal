"use client";

import { useEffect, useState } from "react";
import { emitToast } from "./Toast";
import { Icon } from "./icons";
import { pushSupported, isSubscribed, subscribeToPush } from "./pushShared";

const DISMISS_KEY = "fgm_push_prompt_dismissed";

/** Gentle banner nudging every player to turn on phone notifications (one tap). */
export function PushPrompt() {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!pushSupported()) return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;
    if (Notification.permission === "denied") return;
    isSubscribed().then((sub) => {
      if (!sub) setShow(true);
    });
  }, []);

  if (!show) return null;

  async function enable() {
    setBusy(true);
    const res = await subscribeToPush();
    setBusy(false);
    if (res.ok) {
      emitToast(res.message ?? "Notificări active.", "success");
      setShow(false);
    } else {
      emitToast(res.error ?? "Nu am putut activa notificările.", "error");
    }
  }

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
    setShow(false);
  }

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-4 dark:border-brand-800 dark:bg-brand-950/40">
      <Icon.Bell className="mt-0.5 h-5 w-5 shrink-0 text-brand-600 dark:text-brand-400" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-brand-800 dark:text-brand-200">Pornește notificările</p>
        <p className="mt-0.5 text-xs text-brand-700/80 dark:text-brand-300/80">
          Primești alertă când apare un meci nou sau trebuie să votezi rankingurile.
        </p>
        <div className="mt-3 flex gap-2">
          <button onClick={enable} disabled={busy} className="btn-primary btn-sm">
            {busy ? "Se procesează…" : "Activează"}
          </button>
          <button onClick={dismiss} className="btn-ghost btn-sm">Mai târziu</button>
        </div>
      </div>
    </div>
  );
}
