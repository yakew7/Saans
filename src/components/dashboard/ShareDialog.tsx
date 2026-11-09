"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Download, Link2, Share2, X } from "lucide-react";
import { useState } from "react";
import type { Place } from "@/lib/places";

/** Shareable AQI card: PNG preview, download, Web Share API (with file when supported) and copy link. */
export function ShareDialog({ place }: { place: Place }) {
  const [format, setFormat] = useState<"wide" | "square">("wide");
  const [msg, setMsg] = useState("");
  const [loaded, setLoaded] = useState(false);
  const qs = `lat=${place.lat.toFixed(4)}&lon=${place.lon.toFixed(4)}&name=${encodeURIComponent(place.name)}`;
  const cardUrl = `/api/card?${qs}&format=${format}`;
  const filename = `saans-${place.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-aqi.png`;
  const pageUrl = () => `${window.location.origin}/?${qs}`;

  async function blob(): Promise<Blob> {
    const res = await fetch(cardUrl);
    if (!res.ok) throw new Error("card failed");
    return res.blob();
  }

  async function download() {
    try {
      const b = await blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(b);
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      setMsg("Card downloaded.");
    } catch {
      setMsg("Couldn't create the card right now. Please try again.");
    }
  }

  async function share() {
    const text = `Air quality in ${place.name} right now, on Saans.`;
    try {
      const b = await blob();
      const file = new File([b], filename, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: "Saans air quality", text, url: pageUrl() });
      else if (navigator.share) await navigator.share({ title: "Saans air quality", text, url: pageUrl() });
      else setMsg("Sharing isn't supported in this browser. Use Download or Copy link instead.");
    } catch (e) {
      if ((e as Error).name !== "AbortError") setMsg("Couldn't open the share sheet. Use Download or Copy link instead.");
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(pageUrl());
      setMsg("Link copied.");
    } catch {
      setMsg(`Copy this link: ${pageUrl()}`);
    }
  }

  return (
    <Dialog.Root onOpenChange={() => { setMsg(""); setLoaded(false); }}>
      <Dialog.Trigger asChild>
        <button type="button" className="inline-flex h-10 items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 text-sm font-medium hover:bg-[color:var(--surface-2)]">
          <Share2 size={14} aria-hidden /> Share
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[1100] bg-black/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[1101] max-h-[92dvh] w-[min(94vw,40rem)] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5 shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="font-display text-2xl">Share this air quality card</Dialog.Title>
              <Dialog.Description className="text-sm text-[color:var(--muted)]">A picture of the current reading for {place.name}, with its source and time.</Dialog.Description>
            </div>
            <Dialog.Close aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full hover:bg-[color:var(--surface-2)]"><X size={16} aria-hidden /></Dialog.Close>
          </div>
          <div className="mt-3 flex gap-2" role="group" aria-label="Card shape">
            {(["wide", "square"] as const).map((f) => (
              <button key={f} type="button" aria-pressed={format === f} onClick={() => { setFormat(f); setLoaded(false); }} className="rounded-full border border-[color:var(--border)] px-3 py-1 text-xs font-semibold aria-pressed:bg-[color:var(--ink)] aria-pressed:text-[color:var(--bg)]">
                {f === "wide" ? "Wide (link previews)" : "Square (WhatsApp, Instagram)"}
              </button>
            ))}
          </div>
          <div className="mt-3 overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-2)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img key={cardUrl} src={cardUrl} alt={`Air quality card for ${place.name}`} onLoad={() => setLoaded(true)} className={`mx-auto max-h-[50dvh] w-full object-contain ${loaded ? "" : "min-h-40 opacity-30"}`} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={download} className="inline-flex items-center gap-2 rounded-full bg-[color:var(--ink)] px-4 py-2 text-sm font-medium text-[color:var(--bg)]"><Download size={14} aria-hidden /> Download PNG</button>
            <button type="button" onClick={share} className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-medium hover:bg-[color:var(--surface-2)]"><Share2 size={14} aria-hidden /> Share…</button>
            <button type="button" onClick={copy} className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-medium hover:bg-[color:var(--surface-2)]"><Link2 size={14} aria-hidden /> Copy link</button>
          </div>
          <p role="status" aria-live="polite" className="mt-2 min-h-5 text-xs text-[color:var(--muted)]">{msg}</p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
