"use client";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { AtmosphericBackground } from "./atmospheric-background";
import type { Forecast } from "@/lib/schemas";

interface CitizenForecastProps {
  currentAqi: number;
  forecasts: Forecast[];
}

function getAqiBand(aqi: number): string {
  if (aqi <= 50) return "GOOD";
  if (aqi <= 100) return "MODERATE";
  if (aqi <= 200) return "POOR";
  if (aqi <= 300) return "SEVERE";
  return "HAZARDOUS";
}

function getBandColor(band: string): string {
  if (band === "GOOD") return "#10b981";
  if (band === "MODERATE") return "#eab308";
  if (band === "POOR") return "#f97316";
  if (band === "SEVERE") return "#ef4444";
  return "#a855f7";
}

export function CitizenForecast({ currentAqi, forecasts }: CitizenForecastProps) {
  // If no forecasts returned from API, fallback gracefully
  const hasForecasts = forecasts && forecasts.length > 0;

  // Chart data: starting from Current (0h) through 6h, 24h, 72h
  const chartData = [
    {
      horizon: "Now",
      aqi: currentAqi,
      // No band. This drew currentAqi plus or minus 25, a width nothing
      // measured -- an invented uncertainty on an observation that has none.
      // A missing band reads as "no interval here", which is the truth; a
      // drawn one reads as a model output.
      ciLow: null,
      ciHigh: null,
      ciRange: null,
    },
    ...forecasts.map((f) => ({
      horizon: `${f.horizonHours}h`,
      aqi: f.aqi,
      // The model's own interval, converted server-side by the CPCB scale.
      // This was f.ciLow * 1.5, which invented the width.
      ciLow: f.aqiLow,
      ciHigh: f.aqiHigh,
      ciRange: [f.aqiLow, f.aqiHigh],
    })),
  ];

  return (
    <div className="relative rounded-3xl border border-white/10 overflow-hidden shadow-2xl p-6 sm:p-8 space-y-6">
      {/* 1. Atmospheric Blur Background Layer (Rain/Stormy Cloud imagery) */}
      <AtmosphericBackground imageSrc="/backgrounds/rain.jpeg" overlayOpacity={0.84} blur={24} />

      {/* 2. Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-4">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400 font-semibold">
            Predictive Intelligence
          </div>
          <h2 className="text-xl font-mono font-bold text-slate-100 mt-0.5">
            Air Quality Forecast
          </h2>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-mono text-teal-300 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
          <span>72h Horizon</span>
        </div>
      </div>

      {/* 3. Minimal Area Chart with Confidence Interval Band */}
      {hasForecasts ? (
        <div className="space-y-4">
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="citizenAqiGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="horizon"
                  tick={{ fill: "#94a3b8", fontSize: 11, fontFamily: "monospace" }}
                  axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#94a3b8", fontSize: 10, fontFamily: "monospace" }}
                  axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(15, 23, 42, 0.95)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: "12px",
                    color: "#f8fafc",
                    fontFamily: "monospace",
                    fontSize: "12px",
                    boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
                  }}
                  formatter={(value) => [`${value ?? "—"} AQI`, "VAAYU Prediction"]}
                  labelFormatter={(label) => `Horizon: ${String(label)}`}
                />
                {/* Confidence Interval Area */}
                <Area
                  type="monotone"
                  dataKey="ciRange"
                  stroke="none"
                  fill="#0ea5e9"
                  fillOpacity={0.12}
                  name="Confidence Band"
                />
                {/* Main Forecast Curve */}
                <Area
                  type="monotone"
                  dataKey="aqi"
                  stroke="#14b8a6"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#citizenAqiGrad)"
                  dot={{ fill: "#14b8a6", r: 4, stroke: "#0f172a", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* 4. Forecast Horizon Transition Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            {forecasts.map((f) => {
              const currentBand = getAqiBand(currentAqi);
              const targetBand = getAqiBand(f.aqi);
              const targetColor = getBandColor(targetBand);
              const isWorse = f.aqi > currentAqi;

              return (
                <div
                  key={f.id}
                  className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-md space-y-2 hover:border-white/20 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-slate-300">
                      +{f.horizonHours} HOURS
                    </span>
                    <span
                      className="text-[10px] font-mono font-bold px-2 py-0.5 rounded border"
                      style={{
                        color: targetColor,
                        borderColor: targetColor + "40",
                        backgroundColor: targetColor + "15",
                      }}
                    >
                      {targetBand}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="text-[10px] font-mono text-slate-400">
                      AQI TRAJECTORY
                    </div>
                    <div className="flex items-baseline gap-2 font-mono">
                      <span className="text-sm text-slate-400">{currentAqi}</span>
                      <span className="text-xs text-slate-500">→</span>
                      <span className="text-xl font-bold text-slate-100">
                        {f.aqi}
                      </span>
                    </div>
                  </div>

                  <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5 pt-1 border-t border-white/5">
                    <span>Expected:</span>
                    <span className="text-slate-300">{currentBand}</span>
                    <span>→</span>
                    <span className="font-semibold" style={{ color: targetColor }}>
                      {targetBand}
                    </span>
                    {isWorse && <span className="text-red-400 text-xs">▲</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="p-6 rounded-2xl bg-white/[0.04] border border-white/10 text-center space-y-2">
          <p className="text-sm font-mono text-slate-300">
            Station forecast telemetry is currently updating.
          </p>
          <p className="text-xs text-slate-500">
            VAAYU does not fabricate future projections without validated model weights.
          </p>
        </div>
      )}
    </div>
  );
}
