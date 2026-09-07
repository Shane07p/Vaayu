// web/components/citizen/MapControls.tsx
"use client";

import React, { useState, useEffect, useRef } from 'react';
import type { Map } from 'maplibre-gl';
import { useAQIStore } from '@/store/aqiStore';

import { loadGeoReferenceData } from '@/lib/coordinates';
import { fetchCityRankings } from '@/lib/api';
import type { CityRanking } from '@/lib/schemas';

/** The subset of a Nominatim search result this component reads. */
interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
}

interface SuggestionItem {
  display_name: string;
  lat: number;
  lon: number;
  /** Present when we actually measure this place. Ranked first, and labelled. */
  aqi?: number;
  stationCount?: number;
}

interface Props {
  map: Map | null;
}


/**
 * Cities with a current measurement, cached for the page's lifetime.
 *
 * The ranking endpoint already returns exactly what search needs -- name,
 * coordinates, AQI and station count for every city we measure -- so this needs
 * no endpoint of its own. A failure yields an empty list and search falls back
 * to the reference places, which is a degraded search rather than a broken one.
 */
let measuredCitiesPromise: Promise<CityRanking[]> | null = null;

function measuredCities(): Promise<CityRanking[]> {
  if (!measuredCitiesPromise) {
    measuredCitiesPromise = fetchCityRankings(100)
      .then((result) => result.cities)
      .catch(() => {
        measuredCitiesPromise = null;
        return [] as CityRanking[];
      });
  }
  return measuredCitiesPromise;
}

const MapControls: React.FC<Props> = ({ map }) => {
  const { loadLocationData, locateMe, loading } = useAQIStore();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [locating, setLocating] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoom, setZoom] = useState(9.2);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!map) return;
    const updateZoom = () => setZoom(map.getZoom());
    updateZoom();
    map.on("zoomend", updateZoom);
    return () => {
      map.off("zoomend", updateZoom);
    };
  }, [map]);

  // Debounced search for locations using OpenStreetMap Nominatim + local fallbacks
  useEffect(() => {
    // Clearing happens inside the timer rather than synchronously in the effect
    // body. A synchronous setState here triggers a cascading render on every
    // keystroke, which the react-hooks lint rule flags.
    const tooShort = !query.trim() || query.length < 2;

    const timer = setTimeout(async () => {
      if (tooShort) {
        setSuggestions([]);
        setSearching(false);
        return;
      }
      setSearching(true);
      const qLower = query.toLowerCase().trim();

      // Places we actually measure come first.
      //
      // Search used to run only against the bundled reference list, which is a
      // fixed set of 510 well-known places and does not include several cities
      // that do have live stations -- Mandideep, Mandi Gobindgarh and Bhiwadi
      // among them. A reader could not reach a real reading by typing its name.
      const measured = await measuredCities();
      const measuredMatches: SuggestionItem[] = measured
        .filter((city) => city.city.toLowerCase().includes(qLower))
        .slice(0, 8)
        .map((city) => ({
          display_name: city.city,
          lat: city.lat,
          lon: city.lon,
          aqi: city.aqi,
          stationCount: city.stationCount,
        }));

      // Fetched rather than bundled; see lib/coordinates.ts. Awaiting inside
      // the debounced handler keeps the megabyte off the critical path: the
      // first search pays for it, subsequent ones hit the cached promise.
      const { cities } = await loadGeoReferenceData();

      // Reference places, minus anything already offered as a measured match.
      const alreadyOffered = new Set(measuredMatches.map((m) => m.display_name.toLowerCase()));
      const localMatches: SuggestionItem[] = cities.filter((loc) =>
        !alreadyOffered.has(loc.name.toLowerCase()) && (
          loc.name.toLowerCase().includes(qLower) ||
          loc.state.toLowerCase().includes(qLower) ||
          (loc.stateCode && loc.stateCode.toLowerCase().includes(qLower))
        )
      ).slice(0, 10).map((loc) => ({
        display_name: `${loc.name}, ${loc.state}`,
        lat: loc.lat,
        lon: loc.lon,
      }));

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);

        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5&countrycodes=in`,
          {
            signal: controller.signal,
            headers: { "Accept-Language": "en" },
          }
        );
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          const remoteMatches: SuggestionItem[] = (data as NominatimResult[]).map((item) => ({
            display_name: item.display_name,
            lat: parseFloat(item.lat),
            lon: parseFloat(item.lon),
          }));

          // Measured places lead, then reference places, then geocoder results.
          // A geocoder hit near a place we already offer is dropped: the same
          // point twice, once with a reading and once without, is worse than
          // one entry.
          const combined = [...measuredMatches, ...localMatches];
          for (const rm of remoteMatches) {
            if (!combined.some((c) => Math.abs(c.lat - rm.lat) < 0.05 && Math.abs(c.lon - rm.lon) < 0.05)) {
              combined.push(rm);
            }
          }
          setSuggestions(combined.slice(0, 7));
          setShowDropdown(true);
        } else {
          const combined = [...measuredMatches, ...localMatches];
          setSuggestions(combined);
          setShowDropdown(combined.length > 0);
        }
      } catch {
        // The geocoder is optional. Losing it must not lose the places we
        // actually measure.
        const combined = [...measuredMatches, ...localMatches];
        setSuggestions(combined);
        setShowDropdown(combined.length > 0);
      } finally {
        setSearching(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelectLocation = async (item: SuggestionItem) => {
    setShowDropdown(false);
    setQuery(item.display_name.split(",")[0]);
    await loadLocationData(item.lat, item.lon, item.display_name, map);
  };

  const handleLocateMe = async () => {
    setLocating(true);
    try {
      await locateMe(map);
    } finally {
      setLocating(false);
    }
  };

  const selectLevel = (level: "country" | "state" | "city") => {
    if (!map) return;
    if (level === "country") {
      map.flyTo({ center: [78.9629, 22.5937], zoom: 4.3, essential: true });
    } else if (level === "state") {
      map.flyTo({ zoom: 6.5, essential: true });
    } else if (level === "city") {
      map.flyTo({ zoom: 9.8, essential: true });
    }
  };

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const currentLevel: "country" | "state" | "city" =
    zoom < 5.2 ? "country" : zoom < 7.8 ? "state" : "city";

  return (
    <div
      ref={wrapperRef}
      className="absolute top-20 right-4 sm:right-6 z-30 flex flex-col sm:flex-row items-end sm:items-center gap-2.5 max-w-[calc(100vw-2rem)] transition-all"
    >
      {/* Level Selector: Country / State / City */}
      <label className="flex items-center gap-2 rounded-xl border border-white/15 bg-[#0a0f14]/90 px-3.5 py-2 text-xs font-sans text-slate-200 shadow-2xl backdrop-blur-xl">
        <span className="text-slate-400 font-medium">Level</span>
        <select
          value={currentLevel}
          onChange={(event) => selectLevel(event.target.value as "country" | "state" | "city")}
          className="bg-transparent font-semibold text-teal-300 outline-none cursor-pointer capitalize pr-1"
        >
          <option value="country" className="bg-slate-950 text-slate-100">Country</option>
          <option value="state" className="bg-slate-950 text-slate-100">State</option>
          <option value="city" className="bg-slate-950 text-slate-100">City</option>
        </select>
      </label>

      {/* Search Input Container */}
      <div className="relative w-72 sm:w-80 md:w-96">
        <div className="flex items-center bg-[#0a0f14]/90 hover:bg-[#0d141b] focus-within:bg-[#0d141b] border border-white/15 focus-within:border-teal-400 focus-within:ring-2 focus-within:ring-teal-500/20 rounded-xl px-3.5 py-2 shadow-2xl backdrop-blur-xl transition-all">
          <svg
            className="w-4 h-4 text-teal-400 mr-2.5 flex-shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              if (suggestions.length > 0) setShowDropdown(true);
            }}
            placeholder="Search area, city, or district…"
            className="bg-transparent text-xs font-sans text-slate-100 placeholder-slate-400 focus:outline-none w-full tracking-wide"
          />
          {searching && (
            <div className="w-3.5 h-3.5 border-2 border-teal-400 border-t-transparent rounded-full animate-spin ml-2 flex-shrink-0" />
          )}
          {query && !searching && (
            <button
              onClick={() => {
                setQuery("");
                setSuggestions([]);
                setShowDropdown(false);
              }}
              className="text-slate-400 hover:text-slate-200 text-xs ml-1 flex-shrink-0 px-1.5 py-0.5 rounded-md hover:bg-white/10 transition-colors"
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        {/* Suggestion Dropdown */}
        {showDropdown && suggestions.length > 0 && (
          <div className="absolute top-full mt-2 left-0 right-0 bg-[#080d12]/95 border border-white/15 rounded-2xl shadow-2xl backdrop-blur-2xl py-1.5 overflow-hidden z-40 max-h-72 overflow-y-auto">
            <div className="px-3.5 py-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-400 border-b border-white/5 flex items-center justify-between">
              <span>Locations & Areas</span>
              <span className="text-teal-400/80">{suggestions.length} found</span>
            </div>
            {suggestions.map((item, idx) => (
              <button
                key={idx}
                onClick={() => handleSelectLocation(item)}
                className="w-full text-left px-3.5 py-2.5 text-xs font-sans text-slate-200 hover:bg-teal-500/15 hover:text-teal-100 transition-colors flex items-start gap-2.5 border-b border-white/5 last:border-0 group"
              >
                <span className="text-teal-400 mt-0.5 group-hover:scale-110 transition-transform">📍</span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate text-slate-100 group-hover:text-white">
                    {item.display_name.split(",")[0]}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">
                    {item.aqi !== undefined
                      ? `AQI ${item.aqi} · ${item.stationCount === 1 ? "1 station" : `${item.stationCount} stations`}`
                      : item.display_name.split(",").slice(1).join(",").trim()}
                  </div>
                </div>
                {item.aqi !== undefined && (
                  <span className="text-[10px] font-mono font-medium uppercase tracking-wider text-teal-300 bg-teal-500/15 border border-teal-500/30 rounded-full px-2 py-0.5 mt-0.5 flex-shrink-0">
                    measured
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Action Buttons: Locate Me & Fullscreen */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleLocateMe}
          disabled={locating || loading}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0a0f14]/90 hover:bg-[#0d141b] active:scale-95 text-xs font-sans font-medium text-slate-200 border border-white/15 hover:border-white/30 backdrop-blur-xl shadow-2xl transition-all disabled:opacity-50"
          title="Fly to current GPS location"
        >
          <span className={locating || loading ? "animate-spin text-teal-400" : "text-teal-400"}>
            ◎
          </span>
          <span className="hidden sm:inline">
            {locating ? "Locating…" : "Locate Me"}
          </span>
        </button>

        <button
          onClick={handleToggleFullscreen}
          className="p-2 rounded-xl bg-[#0a0f14]/90 hover:bg-[#0d141b] active:scale-95 text-xs text-slate-300 hover:text-white border border-white/15 hover:border-white/30 backdrop-blur-xl shadow-2xl transition-all"
          title={isFullscreen ? "Exit Fullscreen" : "Toggle Fullscreen"}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            {isFullscreen ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 3H5a2 2 0 00-2 2v3m0 8v3a2 2 0 002 2h3m8-18h3a2 2 0 012 2v3m0 8v3a2 2 0 01-2 2h-3"
              />
            )}
          </svg>
        </button>
      </div>
    </div>
  );
};

export default MapControls;
