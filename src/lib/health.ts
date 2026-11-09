import type { CategoryId } from "./aqi/categories";

export type Level = "ok" | "caution" | "avoid";

export interface Advice {
  headline: string;
  walk: Level;
  run: Level;
  windows: Level;
  mask: string;
  purifier: string;
  actions: string[];
}

/** Plain-language guidance per US AQI category, based on US EPA AirNow AQI basics and CPCB advisories. Not medical advice. */
export const ADVICE: Record<CategoryId, Advice> = {
  good: {
    headline: "A good day to be outside.",
    walk: "ok",
    run: "ok",
    windows: "ok",
    mask: "No mask needed.",
    purifier: "Not needed.",
    actions: ["Open windows to air out your home.", "Enjoy outdoor exercise and playtime."],
  },
  moderate: {
    headline: "Fine for most people; unusually sensitive people should take it easier.",
    walk: "ok",
    run: "ok",
    windows: "ok",
    mask: "No mask needed for most people.",
    purifier: "Optional for people with asthma.",
    actions: ["If you are unusually sensitive, shorten long, intense outdoor workouts.", "Keep reliever inhalers handy if you have asthma."],
  },
  usg: {
    headline: "Sensitive groups should cut back on heavy outdoor effort.",
    walk: "caution",
    run: "caution",
    windows: "caution",
    mask: "Consider an N95/FFP2 mask if you are sensitive and need to be outside for long.",
    purifier: "Helpful indoors, especially in bedrooms.",
    actions: ["Children, older adults and people with heart or lung disease: keep outdoor activity light and short.", "Move strenuous exercise indoors or to a cleaner time of day.", "Close windows during peak traffic hours."],
  },
  unhealthy: {
    headline: "Everyone should reduce prolonged or heavy outdoor exertion.",
    walk: "caution",
    run: "avoid",
    windows: "avoid",
    mask: "Wear a well-fitted N95/FFP2 if you must be outside. Cloth and surgical masks do not filter fine particles.",
    purifier: "Run a HEPA purifier in the room you spend most time in.",
    actions: ["Skip outdoor runs and sports today.", "Keep windows closed; avoid cooking smoke and incense indoors.", "Sensitive groups should stay indoors as much as possible."],
  },
  "very-unhealthy": {
    headline: "Health alert: avoid outdoor exertion.",
    walk: "avoid",
    run: "avoid",
    windows: "avoid",
    mask: "Use a fitted N95/FFP2 for any time outdoors.",
    purifier: "Run a HEPA purifier continuously and keep doors and windows shut.",
    actions: ["Stay indoors; postpone outdoor plans.", "Children, older adults and people with heart or lung conditions should not go out unless essential.", "Seek medical advice if you have chest pain, wheeze or breathlessness."],
  },
  hazardous: {
    headline: "Emergency conditions: stay indoors.",
    walk: "avoid",
    run: "avoid",
    windows: "avoid",
    mask: "If you must go out, wear a properly fitted N95/FFP2 and keep trips short.",
    purifier: "Run a HEPA purifier continuously; seal gaps where you can.",
    actions: ["Stay indoors with windows and doors closed.", "Avoid all outdoor exertion, including commuting on foot or two-wheelers where possible.", "Seek medical help promptly for breathing difficulty or chest discomfort."],
  },
};

export const LEVEL_LABEL: Record<Level, string> = { ok: "Fine", caution: "Take care", avoid: "Avoid" };

export const HEALTH_SOURCES = [
  { label: "US EPA AirNow: AQI basics", url: "https://www.airnow.gov/aqi/aqi-basics/" },
  { label: "US EPA: Air Quality Guide for Particle Pollution", url: "https://www.airnow.gov/publications/air-quality-index/air-quality-guide-for-particle-pollution/" },
  { label: "India CPCB: National Air Quality Index", url: "https://cpcb.nic.in/national-air-quality-index/" },
  { label: "WHO: Global air quality guidelines 2021", url: "https://www.who.int/publications/i/item/9789240034228" },
];
