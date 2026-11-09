import type { Metadata } from "next";
import Link from "next/link";
import { ProvenanceLegend } from "@/components/ui/ProvenanceLegend";
import { WHO_SOURCE_URL, CIGARETTE_SOURCE_URL } from "@/lib/aqi/who";

export const metadata: Metadata = { title: "About & data sources", description: "Where every number in Saans comes from, how it is computed, and the honest limits of the data." };

const A = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a href={href} target="_blank" rel="noreferrer" className="underline underline-offset-2">{children}</a>
);

export default function About() {
  return (
    <article className="mx-auto max-w-3xl space-y-8 pb-8">
      <header>
        <h1 className="font-display text-4xl">About Saans &amp; data sources</h1>
        <p className="mt-2 text-[color:var(--muted)]">Saans (सांस, “breath”) turns raw air quality data into decisions: what the air is, where it is worst, what is coming, and what to do. Its core promise is honesty: every number says where it came from.</p>
      </header>

      <section aria-labelledby="prov-h" className="space-y-3">
        <h2 id="prov-h" className="font-display text-2xl">Provenance policy</h2>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>No air-quality value is hard-coded, randomised or invented. If a source does not report something, you see “—” with the reason, never 0.</li>
          <li>Every number carries a badge (below), the source name, the observation time with timezone, and how long ago we fetched it.</li>
          <li>Readings older than 3 hours are flagged STALE. Readings older than 6 hours are not used as the headline.</li>
          <li>Modelled and forecast data are never shown as measurements, and different sources are never spliced into one unlabelled line.</li>
          <li>The nearest station’s name and its distance from your searched point are always shown.</li>
        </ul>
        <ProvenanceLegend />
      </section>

      <section aria-labelledby="src-h" className="space-y-4">
        <h2 id="src-h" className="font-display text-2xl">Data sources</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead><tr className="border-b border-[color:var(--border)] text-xs uppercase text-[color:var(--muted)]"><th scope="col" className="py-2 pr-3">Source</th><th scope="col" className="py-2 pr-3">Used for</th><th scope="col" className="py-2">Badge</th></tr></thead>
            <tbody className="align-top">
              <tr className="border-b border-[color:var(--border)]/60"><th scope="row" className="py-3 pr-3 font-medium"><A href="https://openaq.org">OpenAQ</A> v3 and its data providers (e.g. India CPCB, US EPA AirNow)</th><td className="py-3 pr-3">Raw station concentrations in µg/m³ (PM2.5, PM10, NO₂, SO₂, CO, O₃), hourly and daily history.</td><td className="py-3">MEASURED, HISTORICAL-MEASURED; our AQI from them is COMPUTED</td></tr>
              <tr className="border-b border-[color:var(--border)]/60"><th scope="row" className="py-3 pr-3 font-medium"><A href="https://aqicn.org">World Air Quality Index Project (WAQI)</A> and the originating US EPA</th><td className="py-3 pr-3">Station AQI, map and station lists, daily pollutant forecast. Pollutant values are AQI <em>sub-indices</em>, not concentrations. WAQI data is cached for minutes only and never stored, per its terms.</td><td className="py-3">MEASURED, FORECAST</td></tr>
              <tr className="border-b border-[color:var(--border)]/60"><th scope="row" className="py-3 pr-3 font-medium"><A href="https://open-meteo.com">Open-Meteo</A> Air Quality API, with the <A href="https://atmosphere.copernicus.eu">Copernicus Atmosphere Monitoring Service (CAMS)</A> ENSEMBLE data</th><td className="py-3 pr-3">Forecasts, modelled history and a fallback where no station exists. Free for non-commercial use; contains modified Copernicus Atmosphere Monitoring Service information.</td><td className="py-3">MODELLED, FORECAST</td></tr>
              <tr className="border-b border-[color:var(--border)]/60"><th scope="row" className="py-3 pr-3 font-medium">Open-Meteo Geocoding and Weather</th><td className="py-3 pr-3">City search; weather features for the experimental ML model.</td><td className="py-3">n/a</td></tr>
              <tr><th scope="row" className="py-3 pr-3 font-medium">Map tiles</th><td className="py-3 pr-3">© <A href="https://www.openstreetmap.org/copyright">OpenStreetMap</A> contributors{" "}and © <A href="https://carto.com/attributions">CARTO</A> where configured.</td><td className="py-3">n/a</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="std-h" className="space-y-3">
        <h2 id="std-h" className="font-display text-2xl">Standards and formulas</h2>
        <ul className="list-disc space-y-1.5 pl-5">
          <li><strong>US AQI</strong> uses the current US EPA breakpoints (40 CFR Part 58 Appendix G, including the 2024 PM2.5 revision). Where a provider supplies an AQI we show theirs; for OpenAQ raw data we compute it from PM2.5 and PM10 using the EPA <A href="https://www.airnow.gov/aqi/aqi-basics/">NowCast</A> method (hourly means) and label it COMPUTED. Gas sub-indices are not included in our computed value.</li>
          <li><strong>India NAQI (PM-only)</strong> uses CPCB breakpoints on 24 h average PM2.5 and PM10 only, so it is labelled “PM-only”. It does not include gases.</li>
          <li><strong>WHO comparisons</strong> use the <A href={WHO_SOURCE_URL}>WHO 2021 Global Air Quality Guidelines</A> (e.g. PM2.5 15 µg/m³ over 24 h, PM10 45 µg/m³).</li>
          <li><strong>Cigarette equivalents</strong> (where shown) use the <A href={CIGARETTE_SOURCE_URL}>Berkeley Earth</A> rule of thumb, about 22 µg/m³ of PM2.5 over 24 h ≈ one cigarette per day. It is a <em>rough heuristic</em>, not a medical statement.</li>
          <li><strong>Percent change</strong> = (B − A) ÷ A × 100 on period means; <strong>spikes</strong> use a rolling median and MAD robust z-score.</li>
        </ul>
      </section>

      <section aria-labelledby="lim-h" className="space-y-3">
        <h2 id="lim-h" className="font-display text-2xl">Honest limitations</h2>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Stations are sparse in many places; the nearest one may be kilometres away. Conditions at your exact spot can differ.</li>
          <li>Two networks often disagree because they use different stations and averaging. We show both and flag gaps over 25%.</li>
          <li>Satellite/model data (CAMS) smooths over a ~11–40 km grid and tends to under-read local peaks such as traffic, burning and firecrackers. See the model-vs-station chart on the Forecast page.</li>
          <li>Some networks have no recent data in some cities (for example, WAQI currently lists no active Mumbai stations). Saans then falls back to another source or a modelled estimate, and says so.</li>
          <li>This is general information, not medical advice.</li>
        </ul>
      </section>

      <p className="text-sm text-[color:var(--muted)]">See live provider health on the <Link href="/status" className="underline">status page</Link>.</p>
    </article>
  );
}
