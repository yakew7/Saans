import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Saans: real-time air quality you can act on",
    short_name: "Saans",
    description: "Live AQI from real stations with honest provenance on every number, plus forecasts, history and health guidance.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f6f4ef",
    theme_color: "#0b6b63",
    categories: ["weather", "health", "utilities"],
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Air quality map", url: "/map" },
      { name: "Forecast", url: "/forecast" },
      { name: "Ask Saans", url: "/assistant" },
    ],
  };
}
