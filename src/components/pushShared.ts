import { savePushSubscriptionAction } from "@/app/actions/notifications";

export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window &&
    !!VAPID_PUBLIC_KEY
  );
}

export async function isSubscribed(): Promise<boolean> {
  if (!pushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    return !!(await reg.pushManager.getSubscription());
  } catch {
    return false;
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export type PushResult = { ok: boolean; message?: string; error?: string };

/** Request permission, subscribe and persist. Must be called from a user gesture. */
export async function subscribeToPush(): Promise<PushResult> {
  if (!pushSupported()) return { ok: false, error: "Dispozitivul nu suportă notificări push." };
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return { ok: false, error: "Permisiunea pentru notificări a fost refuzată." };
    await navigator.serviceWorker.register("/sw.js").catch(() => {});
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!) as unknown as BufferSource,
    });
    return await savePushSubscriptionAction(JSON.stringify(sub));
  } catch {
    return { ok: false, error: "Nu am putut activa notificările." };
  }
}
