"use client";

import { useAQIStore } from "@/store/aqiStore";
import { AtmosphericBackground } from "./atmospheric-background";
import { AqiSeverityScale } from "./aqi-severity-scale";
import { SourceBadge } from "../source-badge";
import type { GridPrediction } from "@/lib/schemas";

interface CitizenHeroProps {
  initialEstimate?: GridPrediction;
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

/**
 * When the estimate was made, read off the estimate itself.
 *
 * This line used to be component state initialised to the literal string
 * "22 AUG 2026 · 14:51 IST", so every reader was told the air had been measured
 * at a quarter to three on a day in August, whatever the data said. A timestamp
 * is a claim about when something was observed, and there is only one honest
 * source for it: the row on screen.
 */
function formatMeasuredAt(iso: string): string {
  const measured = new Date(iso);
  if (Number.isNaN(measured.getTime())) {
    return "unknown";
  }
  const day = measured
    .toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    .toUpperCase();
  const time = measured.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  return `${day} · ${time}`;
}

export function CitizenHero({ initialEstimate }: CitizenHeroProps) {
  // Locating is the store's job, not this component's. The button here used to
  // call getCurrentPosition itself and, on success, rewrite the location label
  // and the timestamp -- without fetching anything. The panel then showed the
  // reader's own coordinates and the current time above the estimate for
  // wherever the map had previously been, which is the same number relabelled
  // as a measurement of somewhere else.
  const { locationName, loading, locateMe } = useAQIStore();

  // Every one of these had a hardcoded fallback -- 182 ug/m3, a 142-231 range,
  // 67% coverage, cell "NCR-0042", model "VAAYU-XGB-v1" -- shown whenever no
  // estimate was passed. They read as a measurement of somewhere. Absence is
  // now absence.
  // Nothing to report without an estimate. This used to substitute 182 ug/m3, a
  // 142-231 range, 67% coverage, cell "NCR-0042" and model "VAAYU-XGB-v1",
  // which read as a measurement of somewhere.
  if (!initialEstimate) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-slate-300">
        <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-1">
          Air quality
        </div>
        <p className="text-sm text-slate-400">
          No estimate for this location.
        </p>
      </div>
    );
  }

  const pm25 = Math.round(initialEstimate.pm25Q50);
  const pm25Q10 = Math.round(initialEstimate.pm25Q10);
  const pm25Q90 = Math.round(initialEstimate.pm25Q90);
  const coverage = Math.round(initialEstimate.coverageFraction * 100);
  const source = initialEstimate.source;
  const modelVersion = initialEstimate.modelVersion;
  const cellCode = initialEstimate.code;

  // The CPCB value the API computed, not a second implementation here.
  const aqi = initialEstimate.aqi;
  const severity = getSeverityMeta(aqi);

  // The estimate's own timestamp. Grid rows are stored in UTC and rendered in
  // the reader's locale, so the label says which zone it is showing.
  const lastUpdated = formatMeasuredAt(initialEstimate.ts);

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
            Measured: {lastUpdated}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void locateMe()}
            disabled={loading}
            className="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-xs font-mono text-slate-200 border border-white/10 transition-all flex items-center gap-1.5 disabled:opacity-50"
            title="Use current GPS location"
          >
            <span className={loading ? "animate-spin" : ""}>⌖</span>
            <span>{loading ? "Locating…" : "Locate Me"}</span>
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

      {/* 5. Meteorological context, when there is any.
       *
       * This was four tiles reading 34°C · Sunny, 44%, 21.2 km/h NW and a UV
       * index of 8.1, under the heading "Meteorological Context (IMD / ERA5)".
       * None of it came from anywhere. It was constant across every location,
       * every AQI band and every day, and it was attributed by name to the India
       * Meteorological Department and to ERA5 reanalysis -- two real sources,
       * neither of which had said any such thing.
       *
       * Fabricated numbers are bad; fabricated numbers wearing somebody else's
       * name are worse, because a reader who checks the attribution is misled
       * twice. VAAYU does not currently ingest meteorology for the citizen
       * surface: met_snapshot is empty, because the Earth Engine credential that
       * feeds ERA5 has never been issued.
       *
       * So the strip says that. When the credential arrives and met_snapshot
       * fills, this becomes a real panel reading real columns. Until then the
       * honest rendering of "we have no weather data" is the sentence "we have
       * no weather data".
       */}
      <div className="pt-2 border-t border-white/10">
        <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-2">
          Meteorological context
        </div>
        <p className="text-[11px] font-mono text-slate-500">
          Not ingested yet. Temperature, humidity, wind and UV are not shown
          because VAAYU has not measured them here.
        </p>
      </div>

      {/* Footer Model Disclaimer */}
      <div className="text-[10px] font-mono text-slate-400 flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/5">
        <span>Model: {modelVersion}</span>
        <span>Resolution: 1 km PostGIS Surface</span>
      </div>
    </div>
  );
}
