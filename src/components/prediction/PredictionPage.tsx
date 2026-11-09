"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, FlaskConical, XCircle } from "lucide-react";
import { Area, CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtLocal } from "@/lib/format";
import { fetchJsonOrThrow } from "@/lib/hooks/useAir";
import type { MlResponse } from "@/lib/ml/pipeline";
import { useAppState } from "@/lib/store";
import { AXIS_TICK, ChartShell, GRID_STROKE, TipBox } from "@/components/charts/ChartShell";
import { DataBadge } from "@/components/ui/DataBadge";
import { Banners, EmptyState, ErrorState, Skeleton } from "@/components/ui/States";

interface Row {
  i: number;
  local: string;
  measured: number | null;
  cams: number | null;
  ml: number | null;
  band: [number, number] | null;
}

function Tip({ active, payload }: { active?: boolean; payload?: { payload: Row }[] }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  const f = (v: number | null) => (v == null ? "—" : `${v.toFixed(0)} µg/m³`);
  return (
    <TipBox title={fmtLocal(r.local)}>
      {r.measured != null && <p>Measured: <strong>{f(r.measured)}</strong></p>}
      {r.ml != null && r.i > 0 && <p>ML prediction: <strong>{f(r.ml)}</strong>{r.band && <span className="text-[color:var(--muted)]"> (typical error ±{((r.band[1] - r.band[0]) / 2).toFixed(0)})</span>}</p>}
      {r.cams != null && <p>CAMS model: <strong>{f(r.cams)}</strong></p>}
    </TipBox>
  );
}

function Verdict({ d }: { d: MlResponse }) {
  const v = d.verdict!;
  const h24 = d.horizons.find((h) => h.h === 24);
  const pct = Math.abs(v.improvementVsPersistence24hPct).toFixed(0);
  const good = v.beatsPersistence24h;
  return (
    <section aria-labelledby="ver-h" className={`card p-5 ${good ? "" : "border-amber-600/60"}`}>
      <h2 id="ver-h" className="font-display text-2xl">Does the model beat the simple baselines?</h2>
      <p className="mt-2 flex items-start gap-2 text-lg">
        {good ? <CheckCircle2 aria-hidden className="mt-1 shrink-0 text-emerald-600" /> : <XCircle aria-hidden className="mt-1 shrink-0 text-amber-600" />}
        <span>
          {good ? (
            <>At 24 hours ahead the model’s average error is <strong>{pct}% lower</strong> than <em>persistence</em> (“it will be the same as now”).</>
          ) : (
            <><strong>Not at 24 hours.</strong> There, simple persistence is {pct}% more accurate than the model. We show the model anyway, because an honest result matters more than a flattering one.</>
          )}
        </span>
      </p>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
        <li>Beats persistence at <strong>{v.horizonsBeatingPersistence} of {v.horizonsTested}</strong> forecast horizons tested (1, 3, 6, 12, 24, 36, 48 h).</li>
        <li>{v.beatsCams24h ? "Beats" : "Does not beat"} the raw CAMS model value at 24 h{h24 ? ` (MAE ${h24.ml.mae.toFixed(1)} vs ${h24.cams.mae.toFixed(1)} µg/m³)` : ""}.</li>
        <li>Errors are in µg/m³ of PM2.5; lower is better. Judged only on hours the model had not seen (walk-forward validation).</li>
      </ul>
    </section>
  );
}

export function PredictionPage() {
  const { current } = useAppState();
  const q = useQuery({
    queryKey: ["ml", current.lat.toFixed(2), current.lon.toFixed(2)],
    queryFn: () => fetchJsonOrThrow<MlResponse>(`/api/ml?lat=${current.lat.toFixed(4)}&lon=${current.lon.toFixed(4)}`),
    staleTime: 3 * 3_600_000,
    retry: 0,
  });
  const d = q.data;

  const rows: Row[] =
    d?.ok
      ? [
          ...d.history.map((h, k) => ({ i: k - 47, local: h.local, measured: h.measured, cams: h.cams, ml: k === 47 ? h.measured : null, band: null })),
          ...d.forecast.map((f) => ({ i: d.forecast.indexOf(f) + 1, local: f.local, measured: null, cams: f.cams, ml: f.ml, band: [f.lo, f.hi] as [number, number] })),
        ]
      : [];
  const max = Math.max(50, ...rows.flatMap((r) => [r.measured ?? 0, r.cams ?? 0, r.ml ?? 0, r.band?.[1] ?? 0]));
  const ticks = rows.filter((r) => r.i % 12 === 0).map((r) => r.i);

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="flex flex-wrap items-center gap-3 font-display text-3xl sm:text-4xl">
          <FlaskConical aria-hidden /> Experimental ML prediction · {current.name}
        </h1>
        <p className="mt-1 text-sm text-[color:var(--muted)]">
          Our own model for the next 48 hours of PM2.5, trained on about 60 days of <strong>measured</strong> hourly data from the nearest station plus weather and the CAMS forecast. It is experimental and always shown next to how well it did in testing.
        </p>
      </div>

      {q.isPending && (
        <div aria-busy="true" className="space-y-3">
          <Skeleton className="h-40 w-full" />
          <p className="text-center text-sm text-[color:var(--muted)]">Training and back-testing the model on live data. This takes a few seconds…</p>
        </div>
      )}
      {q.isError && <ErrorState title="Couldn't run the model" message={(q.error as Error).message} onRetry={() => q.refetch()} />}

      {d && !d.ok && (
        <EmptyState title="No prediction available for this place">
          {d.reason}
          <br />
          This model needs a nearby station with measured hourly PM2.5 history. Try a larger city such as Delhi, Kolkata or Berlin.
        </EmptyState>
      )}

      {d?.ok && d.verdict && d.meta && d.station && d.training && d.origin && (
        <>
          <Banners banners={d.meta.servedStale ? [{ id: "ml-stale", severity: "warn", source: "Open-Meteo", message: "Open-Meteo is unreachable; features use the last cached model data." }] : []} />
          <Verdict d={d} />

          <ChartShell
            title="Last 48 h measured and next 48 h predicted (PM2.5, µg/m³)"
            description={`Measured by ${d.station.name} (${d.station.distanceKm} km). The shaded band is the model’s typical backtest error (RMSE), not a confidence interval.`}
            badge={
              <div className="flex flex-wrap items-center gap-3">
                <DataBadge kind="EXPERIMENTAL-ML" source="Saans ridge regression" observedAt={d.origin} stale={false} detail={`Backtest MAE at 24 h: ${d.horizons.find((h) => h.h === 24)?.ml.mae.toFixed(1)} µg/m³ (persistence ${d.horizons.find((h) => h.h === 24)?.persistence.mae.toFixed(1)}, CAMS ${d.horizons.find((h) => h.h === 24)?.cams.mae.toFixed(1)}).`} />
                {d.oaqMeta && <DataBadge compact kind="HISTORICAL-MEASURED" source="OpenAQ" observedAt={d.oaqMeta.observedAt} fetchedAt={d.oaqMeta.fetchedAt} cached={d.oaqMeta.cached} stale={false} />}
                <DataBadge compact kind="MODELLED" source="Open-Meteo (CAMS)" observedAt={d.meta.observedAt} fetchedAt={d.meta.fetchedAt} cached={d.meta.cached} />
              </div>
            }
            table={
              <table className="w-full text-left text-xs">
                <caption className="sr-only">Predicted PM2.5 for the next 48 hours</caption>
                <thead><tr><th scope="col" className="pr-3">Local time</th><th scope="col" className="pr-3">ML</th><th scope="col" className="pr-3">Typical error range</th><th scope="col">CAMS</th></tr></thead>
                <tbody>{d.forecast.map((f) => <tr key={f.t}><td className="pr-3">{fmtLocal(f.local)}</td><td className="pr-3 tabular-nums">{f.ml}</td><td className="pr-3 tabular-nums">{f.lo}–{f.hi}</td><td className="tabular-nums">{f.cams ?? "—"}</td></tr>)}</tbody>
              </table>
            }
          >
            <div className="h-80 w-full" role="img" aria-label="Chart of measured PM2.5 for the last 48 hours and the machine-learning prediction for the next 48 hours, with the CAMS model for comparison">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={rows} margin={{ top: 22, right: 12, bottom: 4, left: -8 }}>
                  <defs>
                    <pattern id="mlHatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" stroke="#a21caf" strokeOpacity="0.2" strokeWidth="2" /></pattern>
                  </defs>
                  <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                  <ReferenceArea x1={0} x2={48} fill="url(#mlHatch)" ifOverflow="hidden" />
                  <XAxis dataKey="i" type="number" domain={[-47, 48]} ticks={ticks} tickFormatter={(i: number) => { const r = rows.find((x) => x.i === i); return r ? fmtLocal(r.local, "time").slice(0, 2) + "h" : ""; }} tick={AXIS_TICK} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, Math.ceil((max * 1.1) / 50) * 50]} tick={AXIS_TICK} tickLine={false} axisLine={false} width={44} />
                  <Tooltip content={<Tip />} cursor={{ stroke: "var(--muted)", strokeDasharray: "2 4" }} />
                  <ReferenceLine x={0} stroke="var(--ink)" strokeWidth={2} label={{ value: "NOW", position: "top", fill: "var(--ink)", fontSize: 11, fontWeight: 700 }} />
                  <Area dataKey="band" stroke="none" fill="#a21caf" fillOpacity={0.14} isAnimationActive={false} connectNulls={false} />
                  <Line dataKey="cams" type="monotone" stroke="#7c3aed" strokeWidth={2} strokeDasharray="1 5" strokeLinecap="round" dot={false} isAnimationActive={false} connectNulls />
                  <Line dataKey="measured" type="monotone" stroke="var(--ink)" strokeWidth={3} dot={false} isAnimationActive={false} connectNulls={false} />
                  <Line dataKey="ml" type="monotone" stroke="#a21caf" strokeWidth={3} strokeDasharray="8 5" dot={false} isAnimationActive={false} connectNulls={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs" aria-label="Legend">
              <li className="flex items-center gap-1.5"><span aria-hidden className="h-1 w-6 rounded bg-[color:var(--ink)]" />Measured (station)</li>
              <li className="flex items-center gap-1.5"><span aria-hidden className="w-6 border-t-[3px] border-dashed border-[#a21caf]" />ML prediction (experimental)</li>
              <li className="flex items-center gap-1.5"><span aria-hidden className="w-6 border-t-2 border-dotted border-[#7c3aed]" />CAMS model</li>
              <li className="flex items-center gap-1.5"><span aria-hidden className="h-3 w-6 rounded-sm bg-[#a21caf]/15" />Typical error band</li>
            </ul>
          </ChartShell>

          <section aria-labelledby="bt-h" className="card p-5">
            <h2 id="bt-h" className="font-display text-2xl">Backtest: model vs baselines</h2>
            <p className="mt-1 text-sm text-[color:var(--muted)]">
              Walk-forward validation on hours the model had never seen: train on the past, test on the next block, repeat three times. MAE and RMSE in µg/m³ (lower is better). Best per row in bold.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <caption className="sr-only">Backtest error of the ML model, persistence and CAMS at each horizon</caption>
                <thead>
                  <tr className="border-b border-[color:var(--border)] text-xs uppercase text-[color:var(--muted)]">
                    <th scope="col" className="py-2 pr-3">Hours ahead</th>
                    <th scope="col" className="py-2 pr-3">Test hours</th>
                    <th scope="col" className="py-2 pr-3">ML MAE / RMSE</th>
                    <th scope="col" className="py-2 pr-3">Persistence MAE / RMSE</th>
                    <th scope="col" className="py-2">CAMS MAE / RMSE</th>
                  </tr>
                </thead>
                <tbody>
                  {d.horizons.map((h) => {
                    const best = Math.min(h.ml.mae, h.persistence.mae, h.cams.mae);
                    const cell = (s: { mae: number; rmse: number }) => <span className={s.mae === best ? "font-bold" : ""}>{s.mae.toFixed(1)} / {s.rmse.toFixed(1)}</span>;
                    return (
                      <tr key={h.h} className="border-b border-[color:var(--border)]/60 tabular-nums">
                        <th scope="row" className="py-2 pr-3 font-medium">{h.h} h</th>
                        <td className="py-2 pr-3 text-[color:var(--muted)]">{h.nTest}</td>
                        <td className="py-2 pr-3">{cell(h.ml)}</td>
                        <td className="py-2 pr-3">{cell(h.persistence)}</td>
                        <td className="py-2">{cell(h.cams)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-[color:var(--muted)]">
              <strong>Persistence</strong> = “the next hours will look like now”. <strong>CAMS</strong> = the atmospheric model’s value for the target hour (its analysis value, used as a stand-in for an archived forecast).
            </p>
          </section>

          <section aria-labelledby="how-h" className="card p-5 text-sm">
            <h2 id="how-h" className="font-display text-2xl">How it works, and its limits</h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              <li><strong>Data:</strong> {d.training.hourlyRows.toLocaleString()} measured hourly PM2.5 readings from {d.station.name} ({d.training.from} to {d.training.to}), Open-Meteo weather (wind, humidity, temperature, boundary-layer height, rain) and the CAMS PM2.5 forecast.</li>
              <li><strong>Model:</strong> ridge regression written in TypeScript (no ML library), one model per horizon, predicting the log-change from the current value, so it shrinks toward persistence when the features add little. Features: {d.features.join("; ")}.</li>
              <li><strong>Validation:</strong> expanding-window walk-forward with a purge gap, so nothing from the future leaks into training. The regularisation strength was picked from a small sweep on this same backtest, so scores may be slightly optimistic.</li>
              <li><strong>Limits:</strong> one station, about 60 days of history, linear model. Sudden events outside the training range (a firecracker night, stubble-burning surge) are poorly predicted. Treat it as an experiment, not an advisory.</li>
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
