import { Activity, Bell, Bot, FileText, FlaskConical, Compass, Leaf, GitCompareArrows, HeartPulse, History, LayoutDashboard, Map as MapIcon, Trophy, TrendingUp, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/map", label: "Map", icon: MapIcon },
  { href: "/history", label: "History", icon: History },
  { href: "/compare", label: "Compare", icon: GitCompareArrows },
  { href: "/forecast", label: "Forecast", icon: TrendingUp },
  { href: "/health", label: "Health", icon: HeartPulse },
  { href: "/explore", label: "Explore", icon: Compass },
];

/** Bottom tab bar (mobile): Compare lives inside Explore to keep six tappable tabs. */
export const MOBILE_NAV: NavItem[] = NAV.filter((n) => n.href !== "/compare");

export const STATUS_ITEM: NavItem = { href: "/status", label: "Status", icon: Activity };

export interface ExploreItem extends NavItem {
  blurb: string;
}

/** Tools listed on the Explore hub (only features that are built and verified are listed). */
export const EXPLORE: ExploreItem[] = [
  { href: "/assistant", label: "Ask Saans", icon: Bot, blurb: "A streaming assistant that answers only from the live data, with suggested questions." },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy, blurb: "30+ major cities ranked by live measured AQI, with modelled estimates kept separate." },
  { href: "/prediction", label: "ML prediction", icon: FlaskConical, blurb: "An experimental 48-hour PM2.5 model, always shown with its backtest error against simple baselines." },
  { href: "/report", label: "Impact report", icon: FileText, blurb: "An automated, printable summary of a period: averages, worst days, WHO exceedances, spikes and trend." },
  { href: "/alerts", label: "Smart alerts", icon: Bell, blurb: "Set an AQI level per place and get toasts and browser notifications while Saans is open." },
  { href: "/clean-air", label: "Clean air finder", icon: Leaf, blurb: "The cleanest measured stations within your chosen radius, with direction and a route link." },
  { href: "/compare", label: "Compare locations", icon: GitCompareArrows, blurb: "Put 2 to 4 places side by side with a shareable link." },
  { href: "/status", label: "System status", icon: Activity, blurb: "Live health, latency and rate limits of every data provider." },
];
