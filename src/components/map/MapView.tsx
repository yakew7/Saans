"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { categoryFor } from "@/lib/aqi/categories";
import type { Bounds } from "@/lib/hooks/useStations";
import type { WaqiStationPoint } from "@/lib/sources/waqi";

export interface MapViewProps {
  center: { lat: number; lon: number };
  /** when this changes the map flies to `center` */
  centerKey: string;
  stations: WaqiStationPoint[];
  selectedUid: number | null;
  onSelect: (uid: number) => void;
  onBounds: (b: Bounds) => void;
  dark: boolean;
  heat?: boolean;
}

/**
 * Basemap: CARTO raster tiles need a (free, public-by-design) key since Sept 2026: https://carto.com/basemaps/apikey
 * Set NEXT_PUBLIC_CARTO_KEY to use them. Without it we fall back to OpenStreetMap tiles so the map never
 * shows a watermark. The CARTO key is NOT a secret: it is sent in tile URLs from the browser.
 */
const CARTO_KEY = process.env.NEXT_PUBLIC_CARTO_KEY?.trim();
const BASEMAP = CARTO_KEY
  ? {
      light: `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${CARTO_KEY}`,
      dark: `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=${CARTO_KEY}`,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      invertDark: false,
    }
  : {
      light: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      dark: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      subdomains: "abc",
      invertDark: true,
    };

type AqiMarker = L.Marker & { options: L.MarkerOptions & { aqi?: number } };

function StationLayer({ stations, selectedUid, onSelect, visible }: { stations: WaqiStationPoint[]; selectedUid: number | null; onSelect: (uid: number) => void; visible: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (!visible) return;
    const group = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 48,
      spiderfyOnMaxZoom: true,
      iconCreateFunction: (cluster) => {
        const ms = cluster.getAllChildMarkers() as AqiMarker[];
        const worst = Math.max(...ms.map((m) => m.options.aqi ?? 0));
        const cat = categoryFor(worst);
        return L.divIcon({
          html: `<div class="aqi-cluster" style="background:${cat.color};color:${cat.ink}" title="${ms.length} stations, worst AQI ${worst}">${ms.length}</div>`,
          className: "",
          iconSize: [42, 42],
        });
      },
    });
    for (const s of stations) {
      const cat = categoryFor(s.aqi);
      const icon = L.divIcon({
        html: `<div class="aqi-pin${s.uid === selectedUid ? " is-selected" : ""}" style="background:${cat.color};color:${cat.ink}">${Math.round(s.aqi)}</div>`,
        className: "",
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });
      const m = L.marker([s.lat, s.lon], { icon, title: `${s.name}: AQI ${Math.round(s.aqi)}, ${cat.label}`, keyboard: true, alt: `${s.name} AQI ${Math.round(s.aqi)}` }) as AqiMarker;
      m.options.aqi = s.aqi;
      m.on("click", () => onSelect(s.uid));
      group.addLayer(m);
    }
    map.addLayer(group);
    return () => {
      map.removeLayer(group);
    };
  }, [map, stations, selectedUid, onSelect, visible]);
  return null;
}

function BoundsWatcher({ onBounds }: { onBounds: (b: Bounds) => void }) {
  const map = useMap();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emit = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const b = map.getBounds();
      onBounds({ south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() });
    }, 450);
  };
  useMapEvents({ moveend: emit, zoomend: emit });
  useEffect(() => {
    map.whenReady(emit);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);
  return null;
}

function FlyTo({ center, centerKey }: { center: { lat: number; lon: number }; centerKey: string }) {
  const map = useMap();
  const last = useRef(centerKey);
  useEffect(() => {
    if (last.current === centerKey) return;
    last.current = centerKey;
    map.flyTo([center.lat, center.lon], Math.max(map.getZoom(), 10), { duration: 1.1 });
  }, [map, center, centerKey]);
  return null;
}

export default function MapView({ center, centerKey, stations, selectedUid, onSelect, onBounds, dark }: MapViewProps) {
  return (
    <MapContainer center={[center.lat, center.lon]} zoom={10} minZoom={3} scrollWheelZoom className="h-[62vh] min-h-[360px] w-full lg:h-[calc(100dvh-14rem)]" aria-label="Interactive air quality map">
      <TileLayer
        key={dark ? "d" : "l"}
        url={dark ? BASEMAP.dark : BASEMAP.light}
        attribution={BASEMAP.attribution}
        subdomains={BASEMAP.subdomains}
        maxZoom={19}
        className={dark && BASEMAP.invertDark ? "tiles-dark-filter" : undefined}
      />
      <StationLayer stations={stations} selectedUid={selectedUid} onSelect={onSelect} visible />
      <BoundsWatcher onBounds={onBounds} />
      <FlyTo center={center} centerKey={centerKey} />
    </MapContainer>
  );
}
