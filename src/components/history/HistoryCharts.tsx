"use client";

import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CATEGORIES, categoryFor } from "@/lib/aqi/categories";
import { WHO_2021 } from "@/lib/aqi/who";
import { addDays, daysBetween, type PeriodSummary } from "@/lib/history";
import { AXIS_TICK, GRID_STROKE, TipBox } from "@/components/charts/ChartShell";

const COLOR_A = "#7a8683";
const COLOR_B = "var(--accent)";

interface OverlayRow {
  k: number;
  dateA: string;
  dateB: string;
  aqiA: number | null;
  aqiB: number | null;
}

function overlayRows(a: PeriodSummary, b: PeriodSummary): OverlayRow[] {
  const n = Math.max(daysBetween(a.start, a.end), daysBetween(b.start, b.end)) + 1;
  const mapA = new Map(a.days.map((d) => [d.date, d.aqi]));
  const mapB = new Map(b.days.map((d) => [d.date, d.aqi]));
  return Array.from({ length: n }, (_, k) => {
    const dateA = addDays(a.start, k);
    const dateB = addDays(b.start, k);
    return { k, dateA, dateB, aqiA: mapA.get(dateA) ?? null, aqiB: mapB.get(dateB) ?? null };
  });
}

function Bands({ yMax }: { yMax: number }) {
  return (
    <>
      {CATEGORIES.filter((c) => c.min < yMax).map((c) => (
        <ReferenceArea key={c.id} y1={c.min} y2={Math.min(c.max + 1, yMax)} fill={c.color} fillOpacity={0.1} ifOverflow="hidden" />
      ))}
    </>
  );
}

interface TipProps {
  active?: boolean;
  payload?: { payload: OverlayRow }[];
}

function OverlayTip({ active, payload }: TipProps) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  const row = (label: string, date: string, v: number | null, color: string) => (
    <p className="flex items-center gap-2">
      <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
      <span>{label} · {date}:</span>
      <strong>{v == null ? "no data" : `${v} (${categoryFor(v).label})`}</strong>
    </p>
  );
  return (
    <TipBox title={`Day ${r.k + 1}`}>
      {row("A", r.dateA, r.aqiA, COLOR_A)}
      {row("B", r.dateB, r.aqiB, "var(--accent)")}
    </TipBox>
  );
}

export function AqiOverlayChart({ a, b }: { a: PeriodSummary; b: PeriodSummary }) {
  const rows = overlayRows(a, b);
  const maxV = Math.max(100, ...rows.flatMap((r) => [r.aqiA ?? 0, r.aqiB ?? 0]));
  const yMax = Math.min(500, Math.ceil((maxV * 1.1) / 50) * 50);
  const spikeDots = [
    ...a.spikes.map((s) => ({ ...s, k: daysBetween(a.start, s.date), who: "A" as const })),
    ...b.spikes.map((s) => ({ ...s, k: daysBetween(b.start, s.date), who: "B" as const })),
  ];
  return (
    <div className="h-80 w-full" role="img" aria-label="Line chart of daily AQI for period A and period B, aligned by day">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 16, right: 16, bottom: 4, left: -8 }}>
          <Bands yMax={yMax} />
          <CartesianGrid stroke={GRID_STROKE} vertical={false} />
          <XAxis dataKey="k" tickFormatter={(k) => `D${k + 1}`} tick={AXIS_TICK} tickLine={false} axisLine={false} />
          <YAxis domain={[0, yMax]} tick={AXIS_TICK} tickLine={false} axisLine={false} width={44} />
          <Tooltip content={<OverlayTip />} cursor={{ stroke: "var(--muted)", strokeDasharray: "2 4" }} />
          <Line type="monotone" dataKey="aqiA" name="Period A" stroke={COLOR_A} strokeWidth={2} dot={{ r: 3, fill: COLOR_A }} connectNulls={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="aqiB" name="Period B" stroke={COLOR_B} strokeWidth={3} dot={{ r: 3.5, fill: "var(--accent)" }} connectNulls={false} isAnimationActive={false} />
          {spikeDots.map((s) => (
            <ReferenceDot
              key={`${s.who}-${s.date}`}
              x={s.k}
              y={s.aqi}
              r={7}
              fill="none"
              stroke="var(--ink)"
              strokeWidth={2}
              label={{ value: `Spike ${s.who} ${s.date.slice(5)}`, position: "top", fill: "var(--ink)", fontSize: 11, fontWeight: 600 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

interface PmRow {
  date: string;
  pm25: number | null;
  pm10: number | null;
  trend: number | null;
}

function PmTip({ active, payload }: { active?: boolean; payload?: { payload: PmRow }[] }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  const f = (v: number | null) => (v == null ? "no data" : `${v.toFixed(1)} µg/m³`);
  return (
    <TipBox title={r.date}>
      <p>PM2.5: <strong>{f(r.pm25)}</strong></p>
      <p>PM10: <strong>{f(r.pm10)}</strong></p>
      {r.trend != null && <p className="text-[color:var(--muted)]">PM2.5 trend line: {r.trend.toFixed(1)}</p>}
    </TipBox>
  );
}

export function PmChart({ p }: { p: PeriodSummary }) {
  const rows: PmRow[] = p.days.map((d, i) => ({ date: d.date, pm25: d.pm25, pm10: d.pm10, trend: p.pm25Fitted[i] }));
  const max = Math.max(60, ...rows.flatMap((r) => [r.pm25 ?? 0, r.pm10 ?? 0]));
  return (
    <div className="h-64 w-full" role="img" aria-label={`Daily PM2.5 and PM10 from ${p.start} to ${p.end}`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 12, right: 12, bottom: 4, left: -8 }}>
          <CartesianGrid stroke={GRID_STROKE} vertical={false} />
          <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} tick={AXIS_TICK} tickLine={false} axisLine={false} minTickGap={16} />
          <YAxis domain={[0, Math.ceil((max * 1.1) / 25) * 25]} tick={AXIS_TICK} tickLine={false} axisLine={false} width={44} />
          <Tooltip content={<PmTip />} cursor={{ stroke: "var(--muted)", strokeDasharray: "2 4" }} />
          <ReferenceLine y={WHO_2021.pm25.shortTerm} stroke="var(--accent)" strokeDasharray="1 5" label={{ value: "WHO PM2.5 15", fill: "var(--muted)", fontSize: 10, position: "insideTopRight" }} />
          <ReferenceLine y={WHO_2021.pm10.shortTerm} stroke="var(--muted)" strokeDasharray="1 5" label={{ value: "WHO PM10 45", fill: "var(--muted)", fontSize: 10, position: "insideBottomRight" }} />
          <Line type="monotone" dataKey="pm10" name="PM10" stroke="#7a8683" strokeWidth={2} dot={{ r: 2.5 }} connectNulls={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="pm25" name="PM2.5" stroke="var(--accent)" strokeWidth={3} dot={{ r: 3 }} connectNulls={false} isAnimationActive={false} />
          <Line type="linear" dataKey="trend" name="PM2.5 trend" stroke="var(--ink)" strokeWidth={1.5} strokeDasharray="1 4" dot={false} connectNulls isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
