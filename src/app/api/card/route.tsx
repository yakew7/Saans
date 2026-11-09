import { ImageResponse } from "next/og";
import { z } from "zod";
import { coordSchema, parseQuery } from "@/lib/api";
import { categoryFor } from "@/lib/aqi/categories";
import { POLLUTANT_INFO } from "@/lib/pollutants";
import { getAirSnapshot } from "@/lib/sources/snapshot";

const schema = coordSchema.extend({
  name: z.string().trim().max(60).default("Your location"),
  format: z.enum(["wide", "square"]).default("wide"),
});

function utc(iso: string | null): string {
  if (!iso) return "time unknown";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "time unknown";
  return `${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" }).format(d)} UTC`;
}

const KIND_LABEL: Record<string, string> = { MEASURED: "MEASURED", COMPUTED: "COMPUTED from measured data", MODELLED: "MODELLED (not a measurement)" };

/** Shareable AQI card (PNG). Real data only: if nothing is available the card says so. */
export async function GET(req: Request) {
  const q = parseQuery(req, schema);
  if ("response" in q) return q.response;
  const { lat, lon, name, format } = q.data;
  const snap = await getAirSnapshot(lat, lon).catch(() => null);
  const p = snap?.primary ?? null;
  const square = format === "square";
  const w = square ? 1080 : 1200;
  const h = square ? 1080 : 630;

  const cat = p?.aqi != null ? categoryFor(p.aqi) : null;
  const bg = cat ? cat.color : "#cfd8d6";
  const ink = cat ? cat.ink : "#14201f";
  const dom = p?.dominant ? POLLUTANT_INFO[p.dominant].symbol : null;

  const img = new ImageResponse(
    (
      <div style={{ width: w, height: h, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: square ? 72 : 56, background: bg, color: ink, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", fontSize: 40, fontWeight: 700 }}>Saans</div>
          <div style={{ display: "flex", fontSize: 24, fontWeight: 700, padding: "8px 18px", borderRadius: 999, border: `3px solid ${ink}` }}>
            {p ? `${KIND_LABEL[p.aqiBadge] ?? p.aqiBadge}` : "NO DATA"}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 600, opacity: 0.85 }}>{name}</div>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <div style={{ display: "flex", fontSize: square ? 380 : 300, fontWeight: 800, lineHeight: 0.9, letterSpacing: -10 }}>{p?.aqi ?? "—"}</div>
            <div style={{ display: "flex", flexDirection: "column", marginLeft: 36, paddingBottom: 18 }}>
              <div style={{ display: "flex", fontSize: 28, fontWeight: 600, opacity: 0.8 }}>US AQI</div>
              <div style={{ display: "flex", fontSize: square ? 64 : 52, fontWeight: 800, maxWidth: square ? 600 : 560 }}>{cat?.label ?? "Not available"}</div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", fontSize: 26, fontWeight: 600, opacity: 0.92 }}>
          <div style={{ display: "flex" }}>
            {p ? `${p.key === "open-meteo" ? "CAMS model estimate" : `${p.meta.source}${p.meta.stationName ? ` · ${p.meta.stationName}` : ""}${p.meta.stationDistanceKm != null ? ` (${p.meta.stationDistanceKm} km)` : ""}`}` : "No source could provide data right now"}
          </div>
          <div style={{ display: "flex", marginTop: 6 }}>{p ? `${dom ? `Dominant: ${dom} · ` : ""}${utc(p.meta.observedAt)}` : ""}</div>
          <div style={{ display: "flex", marginTop: 14, fontSize: 22, opacity: 0.8 }}>Know your air. Decide your day. · Data: OpenAQ, WAQI/US EPA, Open-Meteo/CAMS</div>
        </div>
      </div>
    ),
    { width: w, height: h },
  );
  img.headers.set("cache-control", "public, max-age=300, s-maxage=300, stale-while-revalidate=600");
  return img;
}
