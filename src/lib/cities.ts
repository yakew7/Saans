import type { Place } from "./places";

export interface City extends Place {
  country: string;
  india?: boolean;
}

/** Fixed leaderboard list (static geography, not air-quality data). */
export const CITIES: City[] = [
  { name: "Delhi", lat: 28.6139, lon: 77.209, country: "India", india: true },
  { name: "Mumbai", lat: 19.076, lon: 72.8777, country: "India", india: true },
  { name: "Kolkata", lat: 22.5726, lon: 88.3639, country: "India", india: true },
  { name: "Bengaluru", lat: 12.9716, lon: 77.5946, country: "India", india: true },
  { name: "Chennai", lat: 13.0827, lon: 80.2707, country: "India", india: true },
  { name: "Hyderabad", lat: 17.385, lon: 78.4867, country: "India", india: true },
  { name: "Pune", lat: 18.5204, lon: 73.8567, country: "India", india: true },
  { name: "Lucknow", lat: 26.8467, lon: 80.9462, country: "India", india: true },
  { name: "Ahmedabad", lat: 23.0225, lon: 72.5714, country: "India", india: true },
  { name: "Jaipur", lat: 26.9124, lon: 75.7873, country: "India", india: true },
  { name: "Patna", lat: 25.5941, lon: 85.1376, country: "India", india: true },
  { name: "Chandigarh", lat: 30.7333, lon: 76.7794, country: "India", india: true },
  { name: "Lahore", lat: 31.5204, lon: 74.3587, country: "Pakistan" },
  { name: "Karachi", lat: 24.8607, lon: 67.0011, country: "Pakistan" },
  { name: "Dhaka", lat: 23.8103, lon: 90.4125, country: "Bangladesh" },
  { name: "Kathmandu", lat: 27.7172, lon: 85.324, country: "Nepal" },
  { name: "Beijing", lat: 39.9042, lon: 116.4074, country: "China" },
  { name: "Shanghai", lat: 31.2304, lon: 121.4737, country: "China" },
  { name: "Bangkok", lat: 13.7563, lon: 100.5018, country: "Thailand" },
  { name: "Jakarta", lat: -6.2088, lon: 106.8456, country: "Indonesia" },
  { name: "Tokyo", lat: 35.6762, lon: 139.6503, country: "Japan" },
  { name: "Seoul", lat: 37.5665, lon: 126.978, country: "South Korea" },
  { name: "Dubai", lat: 25.2048, lon: 55.2708, country: "UAE" },
  { name: "Cairo", lat: 30.0444, lon: 31.2357, country: "Egypt" },
  { name: "London", lat: 51.5074, lon: -0.1278, country: "United Kingdom" },
  { name: "Paris", lat: 48.8566, lon: 2.3522, country: "France" },
  { name: "Berlin", lat: 52.52, lon: 13.405, country: "Germany" },
  { name: "New York", lat: 40.7128, lon: -74.006, country: "USA" },
  { name: "Los Angeles", lat: 34.0522, lon: -118.2437, country: "USA" },
  { name: "Mexico City", lat: 19.4326, lon: -99.1332, country: "Mexico" },
  { name: "São Paulo", lat: -23.5505, lon: -46.6333, country: "Brazil" },
  { name: "Sydney", lat: -33.8688, lon: 151.2093, country: "Australia" },
];
