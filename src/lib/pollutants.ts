import type { PollutantId } from "./types";

export const POLLUTANT_INFO: Record<PollutantId, { symbol: string; name: string; plain: string }> = {
  pm25: { symbol: "PM2.5", name: "Fine particles", plain: "Particles under 2.5 µm. They reach deep into the lungs and bloodstream. Sources: vehicles, burning, industry, firecrackers." },
  pm10: { symbol: "PM10", name: "Coarse particles", plain: "Particles under 10 µm, including road and construction dust. They irritate the nose, throat and airways." },
  no2: { symbol: "NO₂", name: "Nitrogen dioxide", plain: "A gas from traffic and combustion. It inflames airways and worsens asthma." },
  so2: { symbol: "SO₂", name: "Sulphur dioxide", plain: "A gas from burning coal and oil. It can trigger breathing problems, especially in people with asthma." },
  co: { symbol: "CO", name: "Carbon monoxide", plain: "An invisible gas from incomplete burning. It reduces the oxygen your blood can carry." },
  o3: { symbol: "O₃", name: "Ozone", plain: "Ground-level ozone forms in sunlight from other pollutants. It irritates the lungs, mostly on hot afternoons." },
};

export const unitLabel = (u: string | null) => (u ? u.replace("ug/m3", "µg/m³") : "");
