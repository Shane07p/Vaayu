"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { type Map } from "maplibre-gl";
import { useAQIStore } from "@/store/aqiStore";
import {
  loadGeoReferenceData,
  type CityLocation,
  type ContinentLocation,
  type CountryLocation,
  type GeoReferenceData,
  type StateLocation,
} from "@/lib/coordinates";

export const getAqiTextColor = (aqi: number): string => {
  if (aqi <= 50) return "#34d399";
  if (aqi <= 100) return "#fbbf24";
  if (aqi <= 150) return "#fb923c";
  if (aqi <= 200) return "#f472b6";
  if (aqi <= 300) return "#c084fc";
  return "#f87171";
};

export const getAqiCategory = (aqi: number): string => {
  if (aqi <= 50) return "Good";
  if (aqi <= 100) return "Moderate";
  if (aqi <= 150) return "Unhealthy for Sensitive Groups";
  if (aqi <= 200) return "Unhealthy";
  if (aqi <= 300) return "Very Unhealthy";
  return "Hazardous";
};

interface DataPoint {
  id: string | number;
  name: string;
  lat: number;
  lon: number;
  aqi: number;
  pm25: number;
  category: string;
  tier: number;
}

const EMPTY_TIERS: DataPoint[][] = [[], [], [], []];

function buildTiers(data: GeoReferenceData): DataPoint[][] {
  return [
    data.continents.map((item: ContinentLocation) => ({ ...item, tier: 0 })),
    data.countries.map((item: CountryLocation) => ({ ...item, tier: 1 })),
    data.states.map((item: StateLocation) => ({ ...item, tier: 2 })),
    data.cities.map((item: CityLocation) => ({
      ...item,
      category: item.category || getAqiCategory(item.aqi),
      tier: 3,
    })),
  ];
}

function getTierForZoom(zoom: number): number {
  if (zoom < 3) return 0;
  if (zoom < 5) return 1;
  if (zoom < 7) return 2;
  return 3;
}

function removeOverlappingPoints(points: DataPoint[], map: Map, tier: number): DataPoint[] {
  const minimumDistance = [92, 72, 56, 34][tier] ?? 34;
  const minimumDistanceSquared = minimumDistance * minimumDistance;
  const visible: Array<{ point: DataPoint; x: number; y: number }> = [];

  for (const point of points) {
    const screenPoint = map.project([point.lon, point.lat]);
    const overlaps = visible.some(({ x, y }) => {
      const dx = screenPoint.x - x;
      const dy = screenPoint.y - y;
      return dx * dx + dy * dy < minimumDistanceSquared;
    });
    if (!overlaps) visible.push({ point, x: screenPoint.x, y: screenPoint.y });
  }

  return visible.map(({ point }) => point);
}

interface Props {
  map: Map | null;
}

const AQIMarkers: React.FC<Props> = ({ map }) => {
  const { loadLocationData, selectCell } = useAQIStore();
  const [geoData, setGeoData] = useState<GeoReferenceData | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const animationFrame = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadGeoReferenceData().then((data) => {
      if (!cancelled) setGeoData(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const tiers = useMemo(() => geoData ? buildTiers(geoData) : EMPTY_TIERS, [geoData]);

  const buildElement = useCallback((point: DataPoint) => {
    const element = document.createElement("button");
    element.type = "button";
    element.className = "vaayu-aqi-marker";
    element.title = `${point.name} — AQI ${point.aqi} (${point.category}), PM2.5 ${point.pm25} µg/m³`;
    element.setAttribute("aria-label", `Open AQI details for ${point.name}`);

    const value = document.createElement("span");
    value.className = "vaayu-aqi-marker__value";
    value.textContent = `${point.aqi}`;
    value.style.setProperty("--aqi-color", getAqiTextColor(point.aqi));
    element.appendChild(value);

    if (point.tier < 3) {
      const name = document.createElement("span");
      name.className = "vaayu-aqi-marker__name";
      name.textContent = point.name;
      element.appendChild(name);
    }

    element.addEventListener("click", (event) => {
      event.stopPropagation();
      if (typeof point.id === "number") selectCell(point.id);
      void loadLocationData(point.lat, point.lon, point.name, map, {
        aqi: point.aqi,
        pm25: point.pm25,
        category: point.category,
        tier: point.tier,
      });
    });
    return element;
  }, [loadLocationData, map, selectCell]);

  useEffect(() => {
    if (!map) return;
    const render = () => {
      if (animationFrame.current) cancelAnimationFrame(animationFrame.current);
      animationFrame.current = requestAnimationFrame(() => {
        const bounds = map.getBounds();
        const tier = getTierForZoom(map.getZoom());
        const points = tiers[tier].filter((point) =>
          point.lat >= bounds.getSouth() && point.lat <= bounds.getNorth()
          && point.lon >= bounds.getWest() && point.lon <= bounds.getEast(),
        );
        const visiblePoints = removeOverlappingPoints(points, map, tier);

        markers.current.forEach((marker) => marker.remove());
        markers.current = visiblePoints.map((point) =>
          new maplibregl.Marker({ element: buildElement(point), anchor: "bottom" })
            .setLngLat([point.lon, point.lat])
            .addTo(map),
        );
      });
    };

    map.on("moveend", render);
    map.on("zoomend", render);
    render();
    return () => {
      if (animationFrame.current) cancelAnimationFrame(animationFrame.current);
      map.off("moveend", render);
      map.off("zoomend", render);
      markers.current.forEach((marker) => marker.remove());
      markers.current = [];
    };
  }, [buildElement, map, tiers]);

  return null;
};

export default AQIMarkers;
