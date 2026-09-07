"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { bandFor, colorFor } from "@/lib/aqi-band";
import { bandName } from "@/lib/guidance";
import { useCitizenI18n } from "@/lib/i18n";
import { useAQIStore } from "@/store/aqiStore";
import type { CityRankings, CityRanking } from "@/lib/schemas";

/** How long ago a reading was measured */
function ago(iso: string, justNow: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return justNow;
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "1 day" : `${days} days`;
}

type RankingScope = "city" | "state" | "country";

export function RankingsView({ rankings }: { rankings: CityRankings | null }) {
  const { t, language } = useCitizenI18n();
  const {
    locationName,
    locationCoords,
    nearestStation,
    selectedCellData,
    locateMe,
    loading: locating,
  } = useAQIStore();

  const [scope, setScope] = useState<RankingScope>("city");
  const [sortBy, setSortBy] = useState<"worst" | "best">("worst");
  const [searchQuery, setSearchQuery] = useState("");

  // Determine user's current area AQI & info
  /**
   * The reader's own area, when we actually know it.
   *
   * Every field may be null. A previous revision ended this chain with
   * `aqi = 168; pm25 = 84.5; stationName = "Anand Vihar (Reference)"` -- a
   * fabricated reading attributed to a real DPCC station, shown whenever
   * nothing else matched. It also matched the typed location against a
   * hand-written table of city AQIs. Both are the failure this project exists
   * to prevent, and the second is worse for being plausible.
   *
   * The honest answer for a place we have not measured is that we have not
   * measured it, so the card renders a dash and offers to locate the reader.
   */
  const userAreaInfo = useMemo(() => {
    let aqi: number | null = null;
    let pm25: number | null = null;
    let stationName: string | null = null;
    let source: "nearest" | "grid" | "cityMatch" | "none" = "none";

    if (nearestStation) {
      aqi = nearestStation.aqi;
      pm25 = nearestStation.pm25;
      stationName = nearestStation.name;
      source = "nearest";
    } else if (selectedCellData) {
      aqi = selectedCellData.aqi;
      pm25 = selectedCellData.pm25Q50;
      stationName = "Local grid cell";
      source = "grid";
    } else {
      // Only the ranking the API actually returned. No local table.
      const locLower = (locationName || "").toLowerCase();
      const matched = (rankings?.cities || []).find((c) =>
        locLower.includes(c.city.toLowerCase()),
      );
      if (matched) {
        aqi = matched.aqi;
        pm25 = matched.pm25;
        stationName = matched.worstStation;
        source = "cityMatch";
      }
    }

    return {
      name: locationName || null,
      aqi,
      pm25,
      stationName,
      source,
      coords: locationCoords,
    };
  }, [locationName, locationCoords, nearestStation, selectedCellData, rankings]);

  /**
   * Ranked cities, from the API alone.
   *
   * This used to fall back to a 28-entry hand-written table when the API
   * returned nothing, each row carrying a synthetic `measuredAt` recomputed on
   * every page load so invented figures always read as minutes old. lib/api.ts
   * deliberately gives fetchCityRankings no seed fallback for exactly this
   * reason: a fabricated ranking of the country's worst air is a claim about
   * real places. An empty list renders the empty state.
   */
  const allCities = useMemo(
    () =>
      (rankings?.cities ?? []).map((c: CityRanking) => ({
        city: c.city,
        aqi: c.aqi,
        pm25: c.pm25,
        worstStation: c.worstStation,
        stationCount: c.stationCount,
        lat: c.lat,
        lon: c.lon,
        measuredAt: c.measuredAt,
      })),
    [rankings],
  );

  /*
   * The state filter is gone with the table that fed it. cityRankingSchema has
   * no state field, and openaq_latest sets station.state to None on purpose --
   * deriving a state from an operator suffix such as DPCC would encode a guess
   * as a fact. Grouping by state needs point-in-polygon against boundary
   * geometry, which we do not yet load.
   */

  // Filtered & Sorted City List
  const filteredCities = useMemo(() => {
    let list = [...allCities];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (c) =>
          c.city.toLowerCase().includes(q) ||
          c.worstStation.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => (sortBy === "worst" ? b.aqi - a.aqi : a.aqi - b.aqi));
    return list;
  }, [allCities, searchQuery, sortBy]);

  /*
   * There is no filteredStates or filteredCountries any more.
   *
   * Both were built from hand-written tables: eleven countries with invented
   * national AQIs attributed to named networks (EPA AirNow, AURN, Soramame),
   * and twenty Indian states with invented figures attributed to named
   * stations. Neither has a data source. We ingest India only, and no station
   * record carries a state.
   *
   * The tabs remain, because the reader's question is a fair one. They now say
   * what we would need in order to answer it.
   */

  // Checks whether a city matches the user's location
  const isUserAreaCity = (cityName: string) => {
    const loc = (userAreaInfo.name || "").toLowerCase();
    const c = cityName.toLowerCase();
    return loc.includes(c) || c.includes(loc);
  };

  const handleLocateUser = async () => {
    try {
      await locateMe();
    } catch {
      // Handled in store
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2">
          {t.rankingsTitle}
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
          {t.rankingsIntro}
        </p>
      </div>

      {/* ───── Highlighted "Your Area" Card ───── */}
      <div className="relative overflow-hidden rounded-2xl border border-teal-500/40 bg-gradient-to-br from-[#0c1920]/95 via-[#081217]/95 to-[#050b0e]/95 p-4 sm:p-5 shadow-[0_0_35px_rgba(20,184,166,0.18)] backdrop-blur-2xl transition-all group">
        {/* Glow overlay accent */}
        <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-teal-500/10 blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-400" />
              </span>
              <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-teal-300">
                {t.yourArea} · Live Focus
              </span>
            </div>

            <h2 className="text-lg sm:text-xl font-bold text-white truncate">
              {userAreaInfo.name ?? "Where you are"}
            </h2>

            <div className="text-xs text-slate-400 mt-0.5 flex flex-wrap items-center gap-2">
              <span>
                {userAreaInfo.stationName ??
                  "No measurement near here yet. Use your location, or open a city below."}
              </span>
              {nearestStation?.distanceKm && (
                <>
                  <span className="text-slate-600">·</span>
                  <span>{nearestStation.distanceKm.toFixed(1)} km {t.away}</span>
                </>
              )}
            </div>
          </div>

          {/* Current Area AQI Display & Actions */}
          <div className="flex items-center gap-4 self-end sm:self-center">
            {/* A dash, not a colour. `colorFor(aqi ?? 150)` painted an amber
                "Moderate" badge for a reading that did not exist, which is a
                claim about the air made out of a default argument. */}
            <div className="text-right">
              {userAreaInfo.aqi === null ? (
                <div className="font-mono text-3xl sm:text-4xl font-black leading-none text-slate-600">
                  —
                </div>
              ) : (
                <>
                  <div
                    className="font-mono text-3xl sm:text-4xl font-black leading-none drop-shadow-sm"
                    style={{ color: colorFor(userAreaInfo.aqi) }}
                  >
                    {userAreaInfo.aqi}
                  </div>
                  <div
                    className="text-[11px] font-semibold mt-1"
                    style={{ color: colorFor(userAreaInfo.aqi) }}
                  >
                    {bandName(bandFor(userAreaInfo.aqi), language)}
                  </div>
                  {userAreaInfo.pm25 !== null && (
                    <div className="text-[10px] font-mono text-slate-400">
                      {userAreaInfo.pm25} µg/m³
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex flex-col gap-1.5 border-l border-white/10 pl-3.5">
              {userAreaInfo.coords && (
                <Link
                  href={`/aqi?lat=${userAreaInfo.coords.lat}&lon=${userAreaInfo.coords.lng}${
                    userAreaInfo.name ? `&name=${encodeURIComponent(userAreaInfo.name)}` : ""
                  }`}
                  className="inline-flex items-center gap-1 rounded-lg border border-teal-500/30 bg-teal-500/10 px-2.5 py-1 text-[11px] font-medium text-teal-200 hover:bg-teal-500/20 hover:border-teal-400 transition-all active:scale-95"
                >
                  <span>View map</span>
                  <span className="text-[10px]">↗</span>
                </Link>
              )}
              <button
                onClick={handleLocateUser}
                disabled={locating}
                className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:bg-white/10 hover:text-white transition-all active:scale-95 disabled:opacity-50"
                title="Detect GPS location"
              >
                <span>{locating ? "Locating…" : "Detect GPS"}</span>
                <span className="text-teal-400">◎</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ───── Scope Switcher Tabs (City / State / Country) ───── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
        {/* Navigation Pills */}
        <div className="inline-flex rounded-xl bg-slate-900/90 p-1 border border-white/10 shadow-inner">
          <button
            onClick={() => setScope("city")}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
              scope === "city"
                ? "bg-gradient-to-r from-teal-500 to-emerald-600 text-white shadow-md"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
            }`}
          >
            <span>🏙️</span>
            <span>{t.cityWise}</span>
            <span className="ml-1 rounded-full bg-black/20 px-1.5 py-0.2 text-[10px]">
              {filteredCities.length}
            </span>
          </button>

          <button
            onClick={() => setScope("state")}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
              scope === "state"
                ? "bg-gradient-to-r from-teal-500 to-emerald-600 text-white shadow-md"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
            }`}
          >
            <span>🗺️</span>
            <span>{t.stateWise}</span>
          </button>

          <button
            onClick={() => setScope("country")}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
              scope === "country"
                ? "bg-gradient-to-r from-teal-500 to-emerald-600 text-white shadow-md"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
            }`}
          >
            <span>🌍</span>
            <span>{t.countryWise}</span>
          </button>
        </div>

        {/* Sort order toggle */}
        <button
          onClick={() => setSortBy(sortBy === "worst" ? "best" : "worst")}
          className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/[0.08] hover:text-white transition-all active:scale-95"
          title="Toggle sort direction"
        >
          <span className="text-slate-400">Sort:</span>
          <span className="text-teal-300 font-semibold">
            {sortBy === "worst" ? t.sortWorst : t.sortBest}
          </span>
          <span className="text-slate-400 text-xs">{sortBy === "worst" ? "↓" : "↑"}</span>
        </button>
      </div>

      {/* ───── Secondary Filters: State Selector (For City view) & Search Bar ───── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Search filter input */}
        <div className="relative flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search city or station…"
            className="w-full rounded-xl border border-white/15 bg-slate-900/90 px-3.5 py-2 text-xs text-slate-200 placeholder-slate-500 focus:border-teal-400 focus:outline-none transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs px-1"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ───── Content by Active Tab ───── */}

      {/* 1. CITY-WISE RANKING */}
      {scope === "city" && (
        <div className="space-y-2.5">
          {filteredCities.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center text-sm text-slate-400">
              {t.rankingsEmpty}
            </div>
          ) : (
            <ol className="space-y-2">
              {filteredCities.map((item, index) => {
                const isUserCity = isUserAreaCity(item.city);
                return (
                  <li key={item.city}>
                    <Link
                      href={`/aqi?lat=${item.lat}&lon=${item.lon}&name=${encodeURIComponent(item.city)}`}
                      className={`flex items-center gap-3.5 rounded-2xl px-4 py-3.5 transition-all group ${
                        isUserCity
                          ? "border-2 border-teal-400/90 bg-teal-950/25 shadow-[0_0_25px_rgba(20,184,166,0.18)] hover:bg-teal-900/30"
                          : "border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/20"
                      }`}
                    >
                      {/* Rank Index */}
                      <span
                        className={`w-7 text-right font-mono text-xs font-bold ${
                          isUserCity ? "text-teal-300" : "text-slate-500"
                        }`}
                      >
                        #{index + 1}
                      </span>

                      {/* City & Station Details */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-semibold text-slate-100 group-hover:text-white truncate">
                            {item.city}
                          </span>
                          {isUserCity && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-teal-500/20 border border-teal-400/50 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide text-teal-200">
                              ★ {t.yourArea}
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] text-slate-400 truncate mt-0.5">
                          {item.worstStation}
                        </div>

                        <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                          {item.stationCount === 1
                            ? t.oneStation
                            : `${t.worstOf} ${item.stationCount} ${t.stationsWord}`}
                          {" · "}
                          {ago(item.measuredAt, t.loading)}
                        </div>
                      </div>

                      {/* AQI & Band Pill */}
                      <div className="text-right flex-shrink-0">
                        <div
                          className="font-mono text-2xl font-black leading-none"
                          style={{ color: colorFor(item.aqi) }}
                        >
                          {item.aqi}
                        </div>
                        <div
                          className="text-[11px] font-semibold leading-tight mt-0.5"
                          style={{ color: colorFor(item.aqi) }}
                        >
                          {bandName(bandFor(item.aqi), language)}
                        </div>
                        <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                          {item.pm25} µg/m³
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}

      {/* 2. STATE-WISE RANKING -- not available, and why */}
      {scope === "state" && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 space-y-3">
          <p className="text-sm text-slate-200">
            We cannot rank Indian states yet.
          </p>
          <p className="text-[12px] leading-relaxed text-slate-400">
            No monitoring station we ingest records which state it sits in.
            OpenAQ gives us a country and sometimes a city, never a state, and
            reading one off an operator name such as DPCC or TNPCB would be a
            guess wearing the appearance of a fact. Grouping honestly needs each
            station&apos;s coordinates matched against state boundary geometry,
            which is not loaded yet.
          </p>
          <p className="text-[12px] leading-relaxed text-slate-400">
            City rankings below are real measurements, from named stations, with
            the time each was taken.
          </p>
        </div>
      )}

      {/* 3. COUNTRY-WISE RANKING -- not available, and why */}
      {scope === "country" && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 space-y-3">
          <p className="text-sm text-slate-200">
            We only measure India.
          </p>
          <p className="text-[12px] leading-relaxed text-slate-400">
            Every station we ingest is inside India, so we have nothing to
            compare other countries against. A table of national figures we had
            not measured would be a claim about places we have never looked at.
          </p>
          <p className="text-[12px] leading-relaxed text-slate-400">
            City rankings below are real measurements, from named stations, with
            the time each was taken.
          </p>
        </div>
      )}


      {/* Attribution & Provenance footer note */}
      <div className="border-t border-white/10 pt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px] font-mono text-slate-400">
        <div>
          {rankings && rankings.cities.length > 0 ? (
            <span className="text-emerald-400 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Live CPCB and state pollution board telemetry
            </span>
          ) : (
            <span className="text-amber-400/90 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              No ranking available. Nothing is shown in its place.
            </span>
          )}
        </div>

        <div className="text-slate-400">
          {t.rankedFrom}
        </div>
      </div>
    </div>
  );
}
