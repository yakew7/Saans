"use client";

import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CATEGORIES, categoryFor } from "@/lib/aqi/categories";
import { fmtLocal } from "@/lib/format";
import type { Hour, PredictedSpike } from "@/lib/forecast";
import { AXIS_TICK, GRID_STROKE, TipBox } from "@/components/charts/ChartShell";

interface Row {
  i: number;
  local: string;
  past: number | null;
  future: number | null;
  isForecast: boolean;
}

function Tip({ active, payload }: { active?: boolean; payload?: { payload: Row }[] }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  const v = r.isForecast ? r.future : r.past;
  return (
    <TipBox title={fmtLocal(r.local)}>
      <p>
        AQI: <strong>{v == null ? "no data" : `${v} (${categoryFor(v).label})`}</strong>
      </p>
      <p className="text-[color:var(--muted)]">{r.isForecast ? "FORECAST (CAMS model)" : "MODELLED (CAMS analysis, past)"}</p>
    </TipBox>
  );
}

export function ForecastChart({ hours, nowIndex, horizon, spikes }: { hours: Hour[]; nowIndex: number; horizon: number; spikes: PredictedSpike[] }) {
  const from = Math.max(0, nowIndex - 24);
  const to = Math.min(hours.length - 1, nowIndex + horizon);
  const rows: Row[] = hours.slice(from, to + 1).map((h, k) => {
    const idx = from + k;
    return { i: idx - nowIndex, local: h.local, past: idx <= nowIndex ? h.aqi : null, future: idx >= nowIndex ? h.aqi : null, isForecast: idx > nowIndex };
  });
  const max = Math.max(100, ...rows.map((r) => r.past ?? r.future ?? 0));
  const yMax = Math.min(500, Math.ceil((max * 1.12) / 50) * 50);
  const step = horizon <= 24 ? 6 : horizon <= 48 ? 12 : 24;
  const ticks = rows.filter((r) => Number(r.local.slice(11, 13)) % step === 0 && r.local.slice(14, 16) === "00").map((r) => r.i);
  const spikeRows = spikes.map((s) => ({ ...s, row: rows.find((r) => r.local === s.local) })).filter((s) => s.row);
  const last = rows.at(-1)?.i ?? 0;
  return (
    <div className="h-80 w-full" role="img" aria-label={`Line chart of hourly AQI: 24 hours of modelled history, then a ${horizon}-hour forecast`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 22, right: 16, bottom: 4, left: -8 }}>
          <defs>
            <pattern id="fcHatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="8" stroke="#0369a1" strokeOpacity="0.22" strokeWidth="2" />
            </pattern>
          </defs>
          {CATEGORIES.filter((c) => c.min < yMax).map((c) => (
            <ReferenceArea key={c.id} y1={c.min} y2={Math.min(c.max + 1, yMax)} fill={c.color} fillOpacity={0.09} ifOverflow="hidden" />
          ))}
          <ReferenceArea x1={0} x2={last} fill="url(#fcHatch)" ifOverflow="hidden" />
          <CartesianGrid stroke={GRID_STROKE} vertical={false} />
          <XAxis dataKey="i" type="number" domain={[rows[0]?.i ?? -24, last]} ticks={ticks} tickFormatter={(i: number) => { const r = rows.find((x) => x.i === i); return r ? `${fmtLocal(r.local, "day").split(",")[0]} ${r.local.slice(11, 13)}h` : ""; }} tick={AXIS_TICK} tickLine={false} axisLine={false} />
          <YAxis domain={[0, yMax]} tick={AXIS_TICK} tickLine={false} axisLine={false} width={44} />
          <Tooltip content={<Tip />} cursor={{ stroke: "var(--muted)", strokeDasharray: "2 4" }} />
          <ReferenceLine x={0} stroke="var(--ink)" strokeWidth={2} label={{ value: "NOW", position: "top", fill: "var(--ink)", fontSize: 11, fontWeight: 700 }} />
          <Line type="monotone" dataKey="past" name="Modelled (past)" stroke="#6b7280" strokeWidth={2.5} dot={false} connectNulls={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="future" name="Forecast" stroke="#0369a1" strokeWidth={3} strokeDasharray="7 5" dot={false} connectNulls={false} isAnimationActive={false} />
          {spikeRows.map((s) => (
            <ReferenceDot key={s.local} x={s.row!.i} y={s.aqi} r={7} fill="none" stroke="var(--ink)" strokeWidth={2} label={{ value: `Predicted spike ${s.aqi}`, position: "top", fill: "var(--ink)", fontSize: 11, fontWeight: 600 }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

interface CheckRow {
  local: string;
  measured: number | null;
  modelled: number | null;
}

function CheckTip({ active, payload }: { active?: boolean; payload?: { payload: CheckRow }[] }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  const f = (v: number | null) => (v == null ? "no data" : `${v.toFixed(1)} µg/m³`);
  return (
    <TipBox title={fmtLocal(r.local)}>
      <p>Measured (station): <strong>{f(r.measured)}</strong></p>
      <p>CAMS model: <strong>{f(r.modelled)}</strong></p>
    </TipBox>
  );
}

export function ModelCheckChart({ rows }: { rows: CheckRow[] }) {
  return (
    <div className="h-64 w-full" role="img" aria-label="Measured PM2.5 from the nearest station compared with the CAMS model for the last 24 hours">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 12, right: 12, bottom: 4, left: -8 }}>
          <CartesianGrid stroke={GRID_STROKE} vertical={false} />
          <XAxis dataKey="local" tickFormatter={(l: string) => l.slice(11, 13) + "h"} tick={AXIS_TICK} tickLine={false} axisLine={false} minTickGap={14} />
          <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={44} />
          <Tooltip content={<CheckTip />} cursor={{ stroke: "var(--muted)", strokeDasharray: "2 4" }} />
          <Line type="monotone" dataKey="modelled" name="CAMS model" stroke="#7c3aed" strokeWidth={2.5} strokeDasharray="1 5" strokeLinecap="round" dot={false} connectNulls={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="measured" name="Measured" stroke="var(--ink)" strokeWidth={3} dot={{ r: 2.5 }} connectNulls={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
