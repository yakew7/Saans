"use client";

import { BellRing, X } from "lucide-react";
import { dismissToast, useToasts } from "@/lib/toast";

export function ToastHost() {
  const toasts = useToasts();
  return (
    <div aria-live="polite" role="status" className="pointer-events-none fixed bottom-20 right-3 z-[1000] flex w-[min(92vw,24rem)] flex-col gap-2 lg:bottom-4">
      {toasts.map((t) => (
        <div key={t.id} className={`pointer-events-auto rise rounded-2xl border p-3 shadow-xl backdrop-blur ${t.tone === "alert" ? "border-red-600/60 bg-[color:var(--surface)]" : "border-amber-600/60 bg-[color:var(--surface)]"}`}>
          <div className="flex items-start gap-2">
            <BellRing size={18} aria-hidden className="mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{t.title}</p>
              {t.body && <p className="mt-0.5 text-sm text-[color:var(--muted)]">{t.body}</p>}
            </div>
            <button type="button" onClick={() => dismissToast(t.id)} aria-label="Dismiss notification" className="grid h-7 w-7 shrink-0 place-items-center rounded-full hover:bg-[color:var(--surface-2)]">
              <X size={14} aria-hidden />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
