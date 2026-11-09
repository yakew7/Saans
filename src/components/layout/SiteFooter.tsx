import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="no-print mt-16 border-t border-[color:var(--border)] pb-28 pt-8 text-sm text-[color:var(--muted)] lg:pb-10">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 md:grid-cols-3">
        <div>
          <p className="font-display text-lg text-[color:var(--ink)]">Saans</p>
          <p className="mt-1">Know your air. Decide your day. Not medical advice.</p>
          <p className="mt-2">
            <Link href="/about" className="underline underline-offset-2">About &amp; sources</Link> ·{" "}
            <Link href="/status" className="underline underline-offset-2">System status</Link>
          </p>
        </div>
        <div className="md:col-span-2">
          <p className="font-semibold text-[color:var(--ink)]">Data credits</p>
          <ul className="mt-1 space-y-1">
            <li>
              Station AQI: <a className="underline" href="https://aqicn.org" target="_blank" rel="noreferrer">World Air Quality Index Project</a> and the originating US EPA.
            </li>
            <li>
              Raw station measurements: <a className="underline" href="https://openaq.org" target="_blank" rel="noreferrer">OpenAQ</a> and its underlying data providers (e.g. CPCB).
            </li>
            <li>
              Forecasts &amp; modelled data: <a className="underline" href="https://open-meteo.com" target="_blank" rel="noreferrer">Open-Meteo</a> with the Copernicus Atmosphere Monitoring Service (CAMS) ENSEMBLE data. Weather: Open-Meteo.
            </li>
            <li>
              Guidelines: <a className="underline" href="https://www.who.int/publications/i/item/9789240034228" target="_blank" rel="noreferrer">WHO 2021</a>, US EPA AirNow, India CPCB.
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
