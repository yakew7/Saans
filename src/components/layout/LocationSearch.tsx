"use client";

import { MapPin, Search, Star } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { placeKey, type Place } from "@/lib/places";
import { store, useAppState } from "@/lib/store";

interface GeoPlace extends Place {
  label: string;
}

/** Global location search: accessible combobox with debounced autocomplete, recents and favourites. */
export function LocationSearch({ className = "" }: { className?: string }) {
  const id = useId();
  const router = useRouter();
  const { favourites, recents } = useAppState();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<GeoPlace[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setStatus("loading");
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error(String(res.status));
        const j = (await res.json()) as { places: { name: string; lat: number; lon: number; country: string | null; label: string }[] };
        setResults(j.places.map((p) => ({ name: p.name, lat: p.lat, lon: p.lon, country: p.country, label: p.label })));
        setStatus("idle");
        setActive(-1);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setStatus("error");
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const term = q.trim();
  const showResults = term.length >= 2;
  const shortcuts: GeoPlace[] = [...favourites, ...recents.filter((r) => !favourites.some((f) => placeKey(f) === placeKey(r)))].map((p) => ({ ...p, label: [p.name, p.country].filter(Boolean).join(", ") }));
  const list = showResults ? results : shortcuts;

  function choose(p: GeoPlace) {
    store.setCurrent({ name: p.name, lat: p.lat, lon: p.lon, country: p.country });
    setQ("");
    setOpen(false);
    router.push("/");
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(list.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter" && active >= 0 && list[active]) {
      e.preventDefault();
      choose(list[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={box} className={`relative ${className}`}>
      <label htmlFor={`${id}-input`} className="sr-only">
        Search for a city or place
      </label>
      <div className="flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 focus-within:ring-2 focus-within:ring-[color:var(--focus)]">
        <Search size={16} aria-hidden className="shrink-0 text-[color:var(--muted)]" />
        <input
          id={`${id}-input`}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${id}-opt-${active}` : undefined}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          placeholder="Search any city…"
          autoComplete="off"
          className="w-full bg-transparent text-sm outline-none placeholder:text-[color:var(--muted)]"
        />
      </div>
      {open && (
        <ul
          id={`${id}-list`}
          role="listbox"
          aria-label={showResults ? "Search results" : "Recent and favourite places"}
          className="absolute left-0 right-0 z-50 mt-2 max-h-80 overflow-auto rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-1 shadow-xl"
        >
          {showResults && status === "loading" && <li className="px-3 py-2 text-sm text-[color:var(--muted)]">Searching…</li>}
          {showResults && status === "error" && <li className="px-3 py-2 text-sm text-red-700 dark:text-red-300">Search is unavailable right now. Try again shortly.</li>}
          {showResults && status === "idle" && !results.length && <li className="px-3 py-2 text-sm text-[color:var(--muted)]">No places found for “{term}”.</li>}
          {!showResults && !list.length && <li className="px-3 py-2 text-sm text-[color:var(--muted)]">Type a city name. Your recent and favourite places will appear here.</li>}
          {list.map((p, i) => {
            const fav = favourites.some((f) => placeKey(f) === placeKey(p));
            return (
              <li
                key={`${placeKey(p)}-${i}`}
                id={`${id}-opt-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(p);
                }}
                onMouseEnter={() => setActive(i)}
                className={`flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm ${i === active ? "bg-[color:var(--surface-2)]" : ""}`}
              >
                {fav ? <Star size={14} aria-hidden className="shrink-0 fill-current" /> : <MapPin size={14} aria-hidden className="shrink-0 text-[color:var(--muted)]" />}
                <span className="truncate">{p.label}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
