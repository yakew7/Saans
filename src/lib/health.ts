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

import { CATEGORIES } from "./aqi/categories";

export interface SensitiveGroup {
  id: string;
  label: string;
  why: string;
  /** first category at which this group should take extra care / avoid outdoor exertion */
  caution: CategoryId;
  avoid: CategoryId;
  tips: string[];
}

export const SENSITIVE_GROUPS: SensitiveGroup[] = [
  {
    id: "children",
    label: "Children",
    why: "Children breathe more air for their body size and their lungs are still developing.",
    caution: "usg",
    avoid: "very-unhealthy",
    tips: ["Move sports and PE indoors when the air is unhealthy.", "Avoid playing near busy roads, even on good days.", "Watch for cough, wheeze or tiredness after outdoor play."],
  },
  {
    id: "older",
    label: "Older adults",
    why: "Age-related changes in the heart and lungs, and more common underlying conditions, raise the risk from fine particles.",
    caution: "usg",
    avoid: "very-unhealthy",
    tips: ["Prefer short, gentle walks at the cleanest time of day.", "Keep regular medicines on hand and stay hydrated.", "Ask for help with errands on very unhealthy days."],
  },
  {
    id: "asthma",
    label: "Asthma, COPD and other lung conditions",
    why: "Particles and gases inflame the airways and can trigger attacks, even at moderate levels.",
    caution: "moderate",
    avoid: "unhealthy",
    tips: ["Carry your reliever inhaler and follow your asthma action plan.", "Reduce intense outdoor exercise from the Moderate level upward if you are sensitive.", "Use a HEPA purifier in the bedroom."],
  },
  {
    id: "heart",
    label: "Heart disease and hypertension",
    why: "Fine particles can raise blood pressure and the risk of heart attack and stroke, particularly over a few days of exposure.",
    caution: "usg",
    avoid: "unhealthy",
    tips: ["Avoid strenuous outdoor effort when the air is unhealthy.", "Seek care urgently for chest pain, palpitations or unusual breathlessness."],
  },
  {
    id: "pregnancy",
    label: "Pregnancy",
    why: "Long-term fine-particle exposure is linked with poorer birth outcomes, so reducing exposure is sensible.",
    caution: "usg",
    avoid: "very-unhealthy",
    tips: ["Limit time near traffic and smoke on poor-air days.", "Consider an N95/FFP2 mask for unavoidable outdoor trips when air is unhealthy.", "Talk to your doctor about any breathing symptoms."],
  },
  {
    id: "workers",
    label: "Outdoor workers, commuters and delivery riders",
    why: "Long hours outdoors, often with physical effort, mean a much higher inhaled dose.",
    caution: "usg",
    avoid: "very-unhealthy",
    tips: ["Wear a fitted N95/FFP2 when AQI is Unhealthy or worse; cloth and surgical masks do not stop fine particles.", "Take breaks in cleaner indoor spaces and schedule heavy tasks for cleaner hours.", "Employers should reduce exposure on severe days."],
  },
];

export type GroupLevel = "normal" | "caution" | "avoid";

export function groupLevel(g: SensitiveGroup, cat: CategoryId): GroupLevel {
  const idx = (id: CategoryId) => CATEGORIES.findIndex((c) => c.id === id);
  if (idx(cat) >= idx(g.avoid)) return "avoid";
  if (idx(cat) >= idx(g.caution)) return "caution";
  return "normal";
}

export const GROUP_LEVEL_LABEL: Record<GroupLevel, string> = { normal: "Usual routine is fine", caution: "Take extra care", avoid: "Avoid outdoor exertion" };

/** CPCB NAQI categories with the official health-impact statements (paraphrased). */
export const NAQI_IMPACTS: { label: string; range: string; impact: string }[] = [
  { label: "Good", range: "0–50", impact: "Minimal impact." },
  { label: "Satisfactory", range: "51–100", impact: "May cause minor breathing discomfort to sensitive people." },
  { label: "Moderately polluted", range: "101–200", impact: "May cause breathing discomfort to people with lung disease such as asthma, and discomfort to people with heart disease, children and older adults." },
  { label: "Poor", range: "201–300", impact: "May cause breathing discomfort to most people on prolonged exposure, and discomfort to people with heart disease." },
  { label: "Very poor", range: "301–400", impact: "May cause respiratory illness on prolonged exposure." },
  { label: "Severe", range: "401–500", impact: "May cause respiratory impact even on healthy people, and serious health impacts on people with lung or heart disease." },
];
