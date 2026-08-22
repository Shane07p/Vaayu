"use client";

import { useState } from "react";
import { AtmosphericBackground } from "./atmospheric-background";
import { AqiSeverityScale } from "./aqi-severity-scale";
import { SourceBadge } from "../source-badge";
import type { GridPrediction } from "@/lib/schemas";

interface CitizenHeroProps {
  initialEstimate?: GridPrediction;
}

function getAqiFromPm25(pm25: number): number {
  // Approximate standard Indian AQI mapping from 24h PM2.5
  if (pm25 <= 30) return Math.round((pm25 / 30) * 50);
  if (pm25 <= 60) return Math.round(50 + ((pm25 - 30) / 30) * 50);
  if (pm25 <= 90) return Math.round(100 + ((pm25 - 60) / 30) * 100);
  if (pm25 <= 120) return Math.round(200 + ((pm25 - 90) / 30) * 100);
  if (pm25 <= 250) return Math.round(300 + ((pm25 - 120) / 130) * 100);
  return Math.min(500, Math.round(400 + ((pm25 - 250) / 150) * 100));
}

function getSeverityMeta(aqi: number) {
  if (aqi <= 50) {
    return {
      band: "GOOD",
      color: "#10b981",
      accentBg: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
      bgImage: "/backgrounds/normal.png",
    };
  }
  if (aqi <= 100) {
    return {
      band: "MODERATE",
      color: "#eab308",
      accentBg: "bg-yellow-500/10 border-yellow-500/30 text-yellow-300",
      bgImage: "/backgrounds/normal.png",
    };
  }
  if (aqi <= 200) {
    return {
      band: "POOR",
      color: "#f97316",
      accentBg: "bg-orange-500/10 border-orange-500/30 text-orange-300",
      bgImage: "/backgrounds/summer.jpg",
    };
  }
  if (aqi <= 300) {
    return {
      band: "SEVERE",
      color: "#ef4444",
      accentBg: "bg-red-500/10 border-red-500/30 text-red-300",
      bgImage: "/backgrounds/summer.jpg",
    };
  }
  return {
    band: "HAZARDOUS",
    color: "#a855f7",
    accentBg: "bg-purple-500/10 border-purple-500/30 text-purple-300",
    bgImage: "/backgrounds/rain.jpeg",
  };
}

export function CitizenHero({ initialEstimate }: CitizenHeroProps) {
  const [locating, setLocating] = useState(false);
  const [locationName, setLocationName] = useState("Delhi-NCR · Central Pilot");
  const [lastUpdated, setLastUpdated] = useState("22 AUG 2026 · 14:51 IST");

  const pm25 = initialEstimate ? Math.round(initialEstimate.pm25Q50) : 182;
  const pm25Q10 = initialEstimate ? Math.round(initialEstimate.pm25Q10) : 142;
  const pm25Q90 = initialEstimate ? Math.round(initialEstimate.pm25Q90) : 231;
  const coverage = initialEstimate ? Math.round(initialEstimate.coverageFraction * 100) : 67;
  const source = initialEstimate?.source ?? "CACHED";
  const modelVersion = initialEstimate?.modelVersion ?? "VAAYU-XGB-v1";
  const cellCode = initialEstimate?.code ?? "NCR-0042";

  const aqi = getAqiFromPm25(pm25);
  const severity = getSeverityMeta(aqi);

  const handleLocate = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setLocationName(
          `${pos.coords.latitude.toFixed(3)}°N, ${pos.coords.longitude.toFixed(3)}°E · Nearest 1 km Cell`
        );
        const now = new Date();
        setLastUpdated(
          `${now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase()} · ${now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} IST`
        );
      },
      () => {
        setLocating(false);
      },
      { timeout: 8000 }
    );
  };

  return (
    <div className="relative rounded-3xl border border-white/10 overflow-hidden shadow-2xl p-6 sm:p-8 space-y-6">
      {/* 1. Atmospheric Blur Background Layer */}
      <AtmosphericBackground imageSrc={severity.bgImage} overlayOpacity={0.82} blur={22} />

      {/* 2. Location & Telemetry Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-b border-white/10 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-subtle-pulse" />
            <span className="text-xs font-mono font-bold tracking-wider text-slate-200 uppercase">
              {locationName}
            </span>
          </div>
          <p className="text-[11px] font-mono text-slate-400">
            Updated: {lastUpdated}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleLocate}
            disabled={locating}
            className="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-xs font-mono text-slate-200 border border-white/10 transition-all flex items-center gap-1.5 disabled:opacity-50"
            title="Use current GPS location"
          >
            <span className={locating ? "animate-spin" : ""}>⌖</span>
            <span>{locating ? "Locating…" : "Locate Me"}</span>
          </button>
          <SourceBadge source={source} />
        </div>
      </div>

      {/* 3. Main AQI Intelligence Display */}
      <div className="space-y-5">
        <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-widest text-slate-400">
          <span>Current Air Quality</span>
          <span>Grid Cell: {cellCode}</span>
        </div>

        {/* Big Numeric Block */}
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4">
          <div className="flex items-baseline gap-3">
            <span
              className="text-6xl sm:text-7xl font-mono font-extrabold tracking-tight"
              style={{ color: severity.color }}
            >
              {aqi}
            </span>
            <div className="space-y-1">
              <span className="text-sm font-mono font-bold tracking-widest text-slate-300">
                AQI
              </span>
              <div>
                <span
                  className={`inline-block px-3 py-0.5 rounded-md text-xs font-mono font-bold uppercase tracking-wider border ${severity.accentBg}`}
                >
                  {severity.band}
                </span>
              </div>
            </div>
          </div>

          {/* PM2.5 Quantile Metrics */}
          <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-md space-y-1.5 min-w-[200px]">
            <div className="flex justify-between items-baseline">
              <span className="text-[10px] font-mono uppercase text-slate-400">
                PM2.5 Median
              </span>
              <span className="text-base font-mono font-bold text-slate-100">
                {pm25} <span className="text-xs font-normal text-slate-400">µg/m³</span>
              </span>
            </div>
            <div className="flex justify-between items-baseline text-[11px] font-mono text-slate-400">
              <span>80% Interval</span>
              <span className="text-slate-300 font-medium">
                {pm25Q10}–{pm25Q90} µg/m³
              </span>
            </div>
            <div className="flex justify-between items-baseline text-[10px] font-mono text-slate-400 pt-1 border-t border-white/5">
              <span>Coverage</span>
              <span className={coverage < 40 ? "text-amber-400 font-bold" : "text-emerald-400"}>
                {coverage}% {coverage < 40 ? "⚠ (Low)" : "Satellite"}
              </span>
            </div>
          </div>
        </div>

        {/* 4. Segmented Severity Scale */}
        <div className="pt-2">
          <AqiSeverityScale aqi={aqi} />
        </div>
      </div>

      {/* 5. Compact Supporting Weather Strip */}
      <div className="pt-2 border-t border-white/10">
        <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-2.5">
          Meteorological Context (IMD / ERA5)
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/5 backdrop-blur-sm">
            <div className="text-[10px] font-mono text-slate-400">TEMPERATURE</div>
            <div className="text-sm font-mono font-semibold text-slate-200 mt-0.5">
              34°C · Sunny
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/5 backdrop-blur-sm">
            <div className="text-[10px] font-mono text-slate-400">HUMIDITY</div>
            <div className="text-sm font-mono font-semibold text-slate-200 mt-0.5">
              44%
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/5 backdrop-blur-sm">
            <div className="text-[10px] font-mono text-slate-400">WIND SPEED</div>
            <div className="text-sm font-mono font-semibold text-slate-200 mt-0.5">
              21.2 km/h NW
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/5 backdrop-blur-sm">
            <div className="text-[10px] font-mono text-slate-400">UV INDEX</div>
            <div className="text-sm font-mono font-semibold text-amber-300 mt-0.5">
              8.1 Very High
            </div>
          </div>
        </div>
      </div>

      {/* Footer Model Disclaimer */}
      <div className="text-[10px] font-mono text-slate-400 flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/5">
        <span>Model: {modelVersion}</span>
        <span>Resolution: 1 km PostGIS Surface</span>
      </div>
    </div>
  );
}
