import { Activity, GitCompareArrows, HeartPulse, History, LayoutDashboard, Map as MapIcon, TrendingUp, type LucideIcon } from "lucide-react";

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
];

export const STATUS_ITEM: NavItem = { href: "/status", label: "Status", icon: Activity };
