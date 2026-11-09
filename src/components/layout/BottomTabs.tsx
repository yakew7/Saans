"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { EXPLORE, MOBILE_NAV } from "./nav";

const EXPLORE_PATHS = EXPLORE.map((e) => e.href);

export function BottomTabs() {
  const path = usePathname();
  return (
    <nav
      aria-label="Primary mobile"
      className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-[color:var(--border)] bg-[color:color-mix(in_srgb,var(--surface)_94%,transparent)] backdrop-blur lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto grid max-w-xl grid-cols-6">
        {MOBILE_NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href) || (href === "/explore" && EXPLORE_PATHS.some((p) => path.startsWith(p)));
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 py-2 text-[10.5px] font-medium ${active ? "text-[color:var(--accent)]" : "text-[color:var(--muted)]"}`}
              >
                <Icon size={20} aria-hidden strokeWidth={active ? 2.5 : 2} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
