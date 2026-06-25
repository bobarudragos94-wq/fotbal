"use client";

import { useEffect, useState } from "react";

type ToastType = "success" | "error";
type Toast = { id: number; message: string; type: ToastType };

/** Fire a toast from anywhere on the client. */
export function emitToast(message: string, type: ToastType = "success") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("fgm-toast", { detail: { message, type } }));
}

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    let counter = 0;
    function onToast(e: Event) {
      const detail = (e as CustomEvent).detail as { message: string; type: ToastType };
      const id = ++counter;
      setToasts((t) => [...t, { id, message: detail.message, type: detail.type }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
    }
    window.addEventListener("fgm-toast", onToast);
    return () => window.removeEventListener("fgm-toast", onToast);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`pointer-events-auto w-full max-w-app animate-fade-in rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${
            t.type === "error" ? "bg-red-600 text-white" : "bg-slate-900 text-white dark:bg-slate-700"
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
