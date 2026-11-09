import { fmtLocal } from "../format";
import { ADVICE, LEVEL_LABEL } from "../health";
import type { Facts } from "./facts";

/**
 * Rule-based "basic mode": answers common questions directly from the real FACTS when no AI model is available.
 * Always labelled as basic mode in the UI.
 */
export function basicAnswer(question: string, f: Facts): string {
  const q = question.toLowerCase();
  const c = f.current;
  if (!c) return `I don't have current air quality data for ${f.place} right now, so I can't answer that. Please try again shortly.`;
  const adv = ADVICE[c.categoryId as keyof typeof ADVICE];
  const where = c.modelled ? `a modelled CAMS estimate for ${f.place}` : `${c.station ?? c.source}${c.distanceKm != null ? ` (${c.distanceKm} km away)` : ""}`;
  const head = `Right now the US AQI in ${f.place} is ${c.aqi} (${c.category}), ${c.badge.toLowerCase()} from ${where}.`;
  const dont = (what: string) => `I don't have ${what} for ${f.place}.`;
  const nm = " (Not medical advice.)";

  if (/mask|n95|ffp2|respirator/.test(q)) return `${head} ${adv.mask}${nm}`;
  if (/purifier|air clean/.test(q)) return `${head} ${adv.purifier}${nm}`;
  if (/window|ventilat/.test(q)) return `${head} Opening windows: ${LEVEL_LABEL[adv.windows].toLowerCase()}. ${adv.actions[adv.actions.length - 1]}${nm}`;
  if (/best time|when .*(go|walk|run|exercise|outside)|safest time|go out|go outside/.test(q)) {
    const b = f.forecast?.best;
    return b ? `The cleanest 2-hour daylight window ${b.day} is ${fmtLocal(b.start, "time")}–${fmtLocal(b.end, "time")}, with a forecast AQI of about ${b.aqi}.${f.forecast?.bestTomorrow ? ` Tomorrow: ${fmtLocal(f.forecast.bestTomorrow.start, "time")}–${fmtLocal(f.forecast.bestTomorrow.end, "time")} (about ${f.forecast.bestTomorrow.aqi}).` : ""} This is a model forecast, not a measurement.` : dont("a forecast window");
  }
  if (/run|jog|exercise|workout|walk|play|outdoor|outside|sport/.test(q))
    return `${head} Walking: ${LEVEL_LABEL[adv.walk].toLowerCase()}. Running or intense exercise: ${LEVEL_LABEL[adv.run].toLowerCase()}. ${adv.headline}${nm}`;
  if (/forecast|tomorrow|next|trend|improv|better|worse|getting|week ahead|will/.test(q)) {
    const fc = f.forecast;
    if (!fc) return dont("a forecast");
    const d = fc.daily.slice(0, 3).map((x) => `${fmtLocal(`${x.date}T00:00`, "day")}: ${x.min}–${x.max}`).join("; ");
    return `The model forecast (CAMS, not measured) looks ${fc.trend} over 5 days. Daily AQI ranges: ${d}.${fc.peak ? ` Peak about ${fc.peak.aqi} around ${fmtLocal(fc.peak.local)}.` : ""}`;
  }
  if (/pm ?2\.?5|pm ?10|pollutant|dominant|particle|which/.test(q)) {
    const rows = c.pollutants.filter((p) => p.value != null && (p.symbol === "PM2.5" || p.symbol === "PM10")).map((p) => `${p.symbol} ${p.value} ${p.unit ?? ""}${p.avg24 != null ? ` (24 h mean ${p.avg24.toFixed(0)})` : ""}${p.whoRatio != null ? `, ${p.whoRatio.toFixed(1)}x the WHO guideline` : ""}`);
    return `${c.dominant ? `The dominant pollutant is ${c.dominant}. ` : ""}${rows.length ? rows.join("; ") + "." : dont("particulate readings")}`;
  }
  if (/trust|accurate|reliab|source|differ|disagree|compare|sure/.test(q)) {
    return c.crossCheck ? `Two measured sources cover ${f.place}: OpenAQ-computed AQI ${c.crossCheck.openaq} vs WAQI ${c.crossCheck.waqi} (${c.crossCheck.diffPct}% apart${c.crossCheck.disagree ? ", they disagree by more than 25%" : ", they agree"}). They are usually different stations.` : `${head} Only one source is available for ${f.place} right now.`;
  }
  if (/week|history|last|past|before|yesterday/.test(q) && f.history) {
    const h = f.history;
    return `Over the last 14 days (${h.badge.toLowerCase()}, ${h.source}): mean AQI ${h.last7Mean ?? "n/a"} in the last 7 days vs ${h.prev7Mean ?? "n/a"} the 7 days before${h.changePct != null ? ` (${h.changePct > 0 ? "+" : ""}${h.changePct}%)` : ""}.${h.worst ? ` Worst day ${h.worst.date} (AQI ${h.worst.aqi}).` : ""}`;
  }
  return `${head} ${adv.headline} You can ask about masks, exercise, the best time to go out, the forecast, PM2.5 or how much to trust the data.${nm}`;
}
