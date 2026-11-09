"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { categoryFor } from "@/lib/aqi/categories";
import { AXIS_TICK, GRID_STROKE, TipBox } from "@/components/charts/ChartShell";
import type { DayValue } from "@/lib/history";

export const COMPARE_COLORS = ["#0b6b63", "#d9480f", "#6d28d9", "#1c64d8"];

export interface TrendSeries {
  name: string;
  days: DayValue[];
}

type Row = { date: string } & Record<string, number | string | null>;

function Tip({ active, payload, series }: { active?: boolean; payload?: { payload: Row }[]; series: TrendSeries[] }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <TipBox title={String(r.date)}>
      {series.map((s, i) => {
        const v = r[`s${i}`] as number | null | undefined;
        return (
          <p key={s.name} className="flex items-center gap-2">
            <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: COMPARE_COLORS[i] }} />
            {s.name}: <strong>{v == null ? "no data" : `${v} (${categoryFor(v).label})`}</strong>
          </p>
        );
      })}
    </TipBox>
  );
}

export function CompareTrendChart({ series }: { series: TrendSeries[] }) {
  const dates = [...new Set(series.flatMap((s) => s.days.map((d) => d.date)))].sort();
  const rows: Row[] = dates.map((date) => {
    const r: Row = { date };
    series.forEach((s, i) => (r[`s${i}`] = s.days.find((d) => d.date === date)?.aqi ?? null));
    return r;
  });
  const max = Math.max(100, ...rows.flatMap((r) => series.map((_, i) => (r[`s${i}`] as number | null) ?? 0)));
  return (
    <div className="h-80 w-full" role="img" aria-label="Line chart comparing daily AQI of the selected locations">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 12, right: 12, bottom: 4, left: -8 }}>
          <CartesianGrid stroke={GRID_STROKE} vertical={false} />
          <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} tick={AXIS_TICK} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis domain={[0, Math.min(500, Math.ceil((max * 1.1) / 50) * 50)]} tick={AXIS_TICK} tickLine={false} axisLine={false} width={44} />
          <Tooltip content={<Tip series={series} />} cursor={{ stroke: "var(--muted)", strokeDasharray: "2 4" }} />
          {series.map((s, i) => (
            <Line key={s.name} type="monotone" dataKey={`s${i}`} name={s.name} stroke={COMPARE_COLORS[i]} strokeWidth={2.5} dot={{ r: 2.5 }} connectNulls={false} isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
