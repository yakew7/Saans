import type { Metadata } from "next";
import Link from "next/link";
import { EXPLORE } from "@/components/layout/nav";

export const metadata: Metadata = { title: "Explore", description: "More ways to understand and act on air quality." };

export default function Explore() {
  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="font-display text-3xl sm:text-4xl">Explore</h1>
        <p className="mt-1 text-sm text-[color:var(--muted)]">More tools built on the same honest, source-labelled data.</p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {EXPLORE.map(({ href, label, icon: Icon, blurb }) => (
          <li key={href}>
            <Link href={href} className="card flex h-full flex-col gap-2 p-5 transition-transform hover:-translate-y-0.5">
              <Icon aria-hidden size={24} />
              <h2 className="font-display text-xl">{label}</h2>
              <p className="text-sm text-[color:var(--muted)]">{blurb}</p>
            </Link>
          </li>
        ))}
      </ul>
      <p className="text-sm text-[color:var(--muted)]">
        Looking for sources and methods? See <Link href="/about" className="underline">About &amp; sources</Link>.
      </p>
    </div>
  );
}
