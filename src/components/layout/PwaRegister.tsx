"use client";

import { useEffect } from "react";

/** Registers the service worker (production only) so the app is installable. */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      /* installability is optional */
    });
  }, []);
  return null;
}
