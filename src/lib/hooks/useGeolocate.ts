"use client";
import { useCallback, useState } from "react";
import { store } from "@/lib/store";

export type GeoStatus = "idle" | "locating" | "denied" | "unavailable" | "error";

/** Browser Geolocation with explicit, graceful states. Never throws; nothing is sent to our server except the coordinates you then look up. */
export function useGeolocate() {
  const [status, setStatus] = useState<GeoStatus>("idle");
  const locate = useCallback(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setStatus("unavailable");
      return;
    }
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        store.setCurrent({ name: "My location", lat: pos.coords.latitude, lon: pos.coords.longitude });
        setStatus("idle");
      },
      (err) => setStatus(err.code === err.PERMISSION_DENIED ? "denied" : "error"),
      { timeout: 10_000, maximumAge: 5 * 60_000, enableHighAccuracy: false },
    );
  }, []);
  return { status, locate };
}

export const GEO_MESSAGES: Record<Exclude<GeoStatus, "idle" | "locating">, string> = {
  denied: "Location permission was denied. No problem: search for your city above, or pick one of the metros.",
  unavailable: "Your browser does not support location. Search for your city instead.",
  error: "We couldn't determine your location. Search for your city instead.",
};
