export interface Place {
  name: string;
  lat: number;
  lon: number;
  country?: string | null;
}

/** City reference coordinates (static geography, not air-quality data). */
export const DELHI: Place = { name: "Delhi", lat: 28.6139, lon: 77.209, country: "India" };

export const INDIA_METROS: Place[] = [
  DELHI,
  { name: "Mumbai", lat: 19.076, lon: 72.8777, country: "India" },
  { name: "Kolkata", lat: 22.5726, lon: 88.3639, country: "India" },
  { name: "Bengaluru", lat: 12.9716, lon: 77.5946, country: "India" },
  { name: "Chennai", lat: 13.0827, lon: 80.2707, country: "India" },
  { name: "Hyderabad", lat: 17.385, lon: 78.4867, country: "India" },
  { name: "Pune", lat: 18.5204, lon: 73.8567, country: "India" },
  { name: "Lucknow", lat: 26.8467, lon: 80.9462, country: "India" },
];

export const placeKey = (p: { lat: number; lon: number }) => `${p.lat.toFixed(2)},${p.lon.toFixed(2)}`;
