"use client";

import { useEffect, useState } from "react";
import { deletePushSubscriptionAction } from "@/app/actions/notifications";
import { emitToast } from "./Toast";
import { VAPID_PUBLIC_KEY, pushSupported, isSubscribed, subscribeToPush } from "./pushShared";

export function PushManager() {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSupported(pushSupported());
    isSubscribed().then(setSubscribed);
  }, []);

  if (!VAPID_PUBLIC_KEY) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Notificările pe telefon nu sunt configurate încă (lipsesc cheile VAPID).
      </p>
    );
  }
  if (!supported) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Dispozitivul tău nu suportă notificări push. Pe iPhone, adaugă întâi aplicația pe ecranul principal.
      </p>
    );
  }

  async function enable() {
    setBusy(true);
    const res = await subscribeToPush();
    if (res.ok) {
      setSubscribed(true);
      emitToast(res.message ?? "Notificări active.", "success");
    } else {
      emitToast(res.error ?? "Nu am putut activa notificările.", "error");
    }
    setBusy(false);
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await deletePushSubscriptionAction(sub.endpoint);
        await sub.unsubscribe().catch(() => {});
      }
      setSubscribed(false);
      emitToast("Notificările pe telefon au fost oprite.", "success");
    } catch {
      emitToast("Nu am putut opri notificările.", "error");
    } finally {
      setBusy(false);
    }
  }

  return subscribed ? (
    <button onClick={disable} disabled={busy} className="btn-ghost w-full">
      {busy ? "Se procesează…" : "Oprește notificările pe telefon"}
    </button>
  ) : (
    <button onClick={enable} disabled={busy} className="btn-primary w-full">
      {busy ? "Se procesează…" : "Activează notificările pe telefon"}
    </button>
  );
}
