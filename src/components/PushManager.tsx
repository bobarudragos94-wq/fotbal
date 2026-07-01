"use client";

import { useEffect, useState } from "react";
import { savePushSubscriptionAction, deletePushSubscriptionAction } from "@/app/actions/notifications";
import { emitToast } from "./Toast";

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function PushManager() {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ok = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && !!VAPID;
    setSupported(ok);
    if (!ok) return;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(!!sub))
      .catch(() => {});
  }, []);

  if (!VAPID) {
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
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        emitToast("Permisiunea pentru notificări a fost refuzată.", "error");
        return;
      }
      await navigator.serviceWorker.register("/sw.js").catch(() => {});
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID!) as unknown as BufferSource,
      });
      const res = await savePushSubscriptionAction(JSON.stringify(sub));
      if (res.ok) {
        setSubscribed(true);
        emitToast(res.message ?? "Notificări active.", "success");
      } else {
        emitToast(res.error, "error");
      }
    } catch {
      emitToast("Nu am putut activa notificările.", "error");
    } finally {
      setBusy(false);
    }
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
