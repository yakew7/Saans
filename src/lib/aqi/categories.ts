export type CategoryId =
  | "good"
  | "moderate"
  | "usg"
  | "unhealthy"
  | "very-unhealthy"
  | "hazardous";

export interface AqiCategory {
  id: CategoryId;
  label: string;
  short: string;
  min: number;
  max: number;
  /** Official US EPA AirNow colour */
  color: string;
  /** readable text colour on top of `color` */
  ink: string;
  /** lucide icon name, so colour is never the only signal */
  icon: "smile" | "meh" | "frown" | "alert-triangle" | "alert-octagon" | "skull";
  summary: string;
}

export const CATEGORIES: AqiCategory[] = [
  { id: "good", label: "Good", short: "Good", min: 0, max: 50, color: "#00e400", ink: "#052e16", icon: "smile", summary: "Air quality is satisfactory and poses little or no risk." },
  { id: "moderate", label: "Moderate", short: "Moderate", min: 51, max: 100, color: "#ffff00", ink: "#3f3a00", icon: "meh", summary: "Acceptable, but unusually sensitive people may notice effects." },
  { id: "usg", label: "Unhealthy for Sensitive Groups", short: "Sensitive", min: 101, max: 150, color: "#ff7e00", ink: "#3b1a00", icon: "frown", summary: "Children, older adults and people with heart or lung conditions should reduce prolonged outdoor exertion." },
  { id: "unhealthy", label: "Unhealthy", short: "Unhealthy", min: 151, max: 200, color: "#ff0000", ink: "#000000", icon: "alert-triangle", summary: "Everyone may begin to experience health effects; sensitive groups may experience more serious effects." },
  { id: "very-unhealthy", label: "Very Unhealthy", short: "Very unhealthy", min: 201, max: 300, color: "#8f3f97", ink: "#ffffff", icon: "alert-octagon", summary: "Health alert: the risk of effects is higher for everyone." },
  { id: "hazardous", label: "Hazardous", short: "Hazardous", min: 301, max: 500, color: "#7e0023", ink: "#ffffff", icon: "skull", summary: "Emergency conditions: everyone is more likely to be affected." },
];

export function categoryFor(aqi: number): AqiCategory {
  const v = Math.round(aqi);
  for (const c of CATEGORIES) if (v <= c.max) return c;
  return CATEGORIES[CATEGORIES.length - 1];
}

/** Indian NAQI (CPCB) categories */
export interface NaqiCategory {
  id: string;
  label: string;
  min: number;
  max: number;
  color: string;
  ink: string;
}

export const NAQI_CATEGORIES: NaqiCategory[] = [
  { id: "good", label: "Good", min: 0, max: 50, color: "#009966", ink: "#000000" },
  { id: "satisfactory", label: "Satisfactory", min: 51, max: 100, color: "#a3c853", ink: "#1f2d05" },
  { id: "moderate", label: "Moderately polluted", min: 101, max: 200, color: "#ffdd33", ink: "#3f3a00" },
  { id: "poor", label: "Poor", min: 201, max: 300, color: "#ff9933", ink: "#3b1a00" },
  { id: "very-poor", label: "Very poor", min: 301, max: 400, color: "#cc0033", ink: "#ffffff" },
  { id: "severe", label: "Severe", min: 401, max: 500, color: "#7e0023", ink: "#ffffff" },
];

export function naqiCategoryFor(v: number): NaqiCategory {
  const r = Math.round(v);
  for (const c of NAQI_CATEGORIES) if (r <= c.max) return c;
  return NAQI_CATEGORIES[NAQI_CATEGORIES.length - 1];
}
