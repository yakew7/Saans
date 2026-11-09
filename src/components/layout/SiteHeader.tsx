"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wind } from "lucide-react";
import { NAV } from "./nav";
import { ThemeToggle } from "./ThemeToggle";

export function SiteHeader() {
  const path = usePathname();
  return (
    <header className="no-print sticky top-0 z-40 border-b border-[color:var(--border)] bg-[color:color-mix(in_srgb,var(--bg)_82%,transparent)] backdrop-blur">
      <a href="#main" className="sr-only-focusable absolute left-2 top-2 z-50 rounded bg-[color:var(--surface)] px-3 py-2">
        Skip to content
      </a>
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2" aria-label="Saans home">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[color:var(--accent)] text-[color:var(--accent-ink)]">
            <Wind size={20} aria-hidden />
          </span>
          <span className="font-display text-2xl leading-none tracking-tight">Saans</span>
        </Link>
        <nav aria-label="Primary" className="ml-4 hidden flex-1 items-center gap-1 lg:flex">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? path === "/" : path.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition-colors ${
                  active ? "bg-[color:var(--ink)] text-[color:var(--bg)]" : "hover:bg-[color:var(--surface-2)]"
                }`}
              >
                <Icon size={16} aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2" id="header-slot" />
        <ThemeToggle />
      </div>
    </header>
  );
}
