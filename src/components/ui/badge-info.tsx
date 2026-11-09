import { Activity, Archive, FlaskConical, Satellite, Sigma, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";
import type { BadgeKind } from "@/lib/types";

export const BADGE_INFO: Record<BadgeKind, { label: string; meaning: string; icon: ReactNode; cls: string }> = {
  MEASURED: {
    label: "MEASURED",
    meaning: "A real reading from a physical monitoring station.",
    icon: <Activity size={12} aria-hidden />,
    cls: "bg-[color:var(--ink)] text-[color:var(--bg)] border-[color:var(--ink)]",
  },
  FORECAST: {
    label: "FORECAST",
    meaning: "A model forecast of future conditions. Not an observation.",
    icon: <TrendingUp size={12} aria-hidden />,
    cls: "border-dashed border-sky-600 text-sky-800 dark:text-sky-300 dark:border-sky-400 bg-sky-500/10",
  },
  MODELLED: {
    label: "MODELLED",
    meaning: "Satellite/atmospheric-model estimate (e.g. CAMS). Not a station measurement.",
    icon: <Satellite size={12} aria-hidden />,
    cls: "hatch border-dotted border-violet-600 text-violet-800 dark:text-violet-300 dark:border-violet-400 bg-violet-500/10",
  },
  "HISTORICAL-MEASURED": {
    label: "HISTORICAL · MEASURED",
    meaning: "Archived station measurements from the past.",
    icon: <Archive size={12} aria-hidden />,
    cls: "border-[color:var(--ink)] text-[color:var(--ink)] bg-transparent",
  },
  COMPUTED: {
    label: "COMPUTED",
    meaning: "Derived by this app from measured values. Hover to see the formula.",
    icon: <Sigma size={12} aria-hidden />,
    cls: "border-emerald-700 text-emerald-900 dark:text-emerald-300 dark:border-emerald-400 bg-emerald-500/10 font-mono",
  },
  "EXPERIMENTAL-ML": {
    label: "EXPERIMENTAL · ML",
    meaning: "Our own machine-learning prediction, shown with its backtest error. Experimental.",
    icon: <FlaskConical size={12} aria-hidden />,
    cls: "border-fuchsia-600 text-fuchsia-900 dark:text-fuchsia-300 dark:border-fuchsia-400 bg-fuchsia-500/10",
  },
};
