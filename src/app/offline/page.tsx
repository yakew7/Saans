import type { Metadata } from "next";

export const metadata: Metadata = { title: "Offline" };

export default function Offline() {
  return (
    <div className="mx-auto max-w-xl py-16 text-center">
      <h1 className="font-display text-4xl">You’re offline</h1>
      <p className="mt-3 text-[color:var(--muted)]">
        Saans needs a connection to fetch live air quality. We deliberately don’t store old readings to show as if they were current. Reconnect and refresh to see the latest data with its true timestamp.
      </p>
    </div>
  );
}
