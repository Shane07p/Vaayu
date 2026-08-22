"use client";

import {
  Area,
  Bar,
  BarChart,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
  CartesianGrid,
} from "recharts";
import type { Forecast } from "@/lib/schemas";

function getAqiBand(aqi: number): string {
  if (aqi <= 50) return "GOOD";
  if (aqi <= 100) return "SATISFACTORY";
  if (aqi <= 200) return "MODERATE";
  if (aqi <= 300) return "POOR";
  if (aqi <= 400) return "VERY POOR";
  return "SEVERE";
}

function getBandColor(aqi: number): string {
  if (aqi <= 50) return "#10b981";
  if (aqi <= 100) return "#22c55e";
  if (aqi <= 200) return "#eab308";
  if (aqi <= 300) return "#f97316";
  if (aqi <= 400) return "#ef4444";
  return "#9333ea";
}

export function ForecastComparison({ forecasts }: { forecasts: Forecast[] }) {
  const data = forecasts.map((forecast) => ({
    horizon: `${forecast.horizonHours}h`,
    horizonHours: forecast.horizonHours,
    vaayu: Math.round(forecast.pm25),
    vaayuAqi: forecast.aqi,
    persistence: Math.round(forecast.baselinePersistence),
    cams: forecast.baselineCams ? Math.round(forecast.baselineCams) : null,
    ciLow: Math.round(forecast.ciLow),
    ciHigh: Math.round(forecast.ciHigh),
    ciRange: [Math.round(forecast.ciLow), Math.round(forecast.ciHigh)],
  }));

  return (
    <div className="space-y-6">
      {/* PM2.5 Comparison Chart */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-200">
              PM2.5 Forecast vs Baselines
            </h3>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              µg/m³ · Confidence interval shown as shaded area
            </p>
          </div>
        </div>

        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="horizon"
                tick={{ fill: "#64748b", fontSize: 11, fontFamily: "monospace" }}
                axisLine={{ stroke: "#1e293b" }}
                tickLine={{ stroke: "#1e293b" }}
              />
              <YAxis
                tick={{ fill: "#64748b", fontSize: 11, fontFamily: "monospace" }}
                axisLine={{ stroke: "#1e293b" }}
                tickLine={{ stroke: "#1e293b" }}
                label={{
                  value: "µg/m³",
                  angle: -90,
                  position: "insideLeft",
                  style: { fill: "#475569", fontSize: 10, fontFamily: "monospace" },
                }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0f172a",
                  border: "1px solid #1e293b",
                  borderRadius: "8px",
                  color: "#e2e8f0",
                  fontFamily: "monospace",
                  fontSize: "12px",
                }}
                labelStyle={{ color: "#94a3b8", fontWeight: "bold" }}
              />
              <Legend
                wrapperStyle={{ fontSize: "11px", fontFamily: "monospace", color: "#94a3b8" }}
              />
              {/* Confidence interval as area */}
              <Area
                type="monotone"
                dataKey="ciRange"
                fill="#14b8a6"
                fillOpacity={0.1}
                stroke="none"
                name="95% CI"
                legendType="none"
              />
              {/* VAAYU Model */}
              <Line
                type="monotone"
                dataKey="vaayu"
                stroke="#14b8a6"
                strokeWidth={3}
                name="VAAYU"
                dot={{ fill: "#14b8a6", r: 5, strokeWidth: 2 }}
                activeDot={{ r: 7, fill: "#14b8a6" }}
              />
              {/* Persistence baseline */}
              <Line
                type="monotone"
                dataKey="persistence"
                stroke="#64748b"
                strokeWidth={1.5}
                strokeDasharray="6 3"
                name="Persistence"
                dot={{ fill: "#64748b", r: 3 }}
              />
              {/* CAMS baseline */}
              <Line
                type="monotone"
                dataKey="cams"
                stroke="#a16207"
                strokeWidth={1.5}
                strokeDasharray="3 3"
                name="CAMS"
                dot={{ fill: "#a16207", r: 3 }}
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Horizon Breakdown Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {forecasts.map((forecast) => {
          const band = getAqiBand(forecast.aqi);
          const bandColor = getBandColor(forecast.aqi);
          const persistDiff = Math.round(forecast.pm25 - forecast.baselinePersistence);
          const camsDiff = forecast.baselineCams
            ? Math.round(forecast.pm25 - forecast.baselineCams)
            : null;

          return (
            <div
              key={forecast.id}
              className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 space-y-4"
            >
              {/* Horizon Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-sm font-mono font-bold text-slate-200">
                    {forecast.horizonHours}H
                  </span>
                  <span className="text-xs text-slate-500 font-mono">FORECAST</span>
                </div>
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold border"
                  style={{
                    color: bandColor,
                    borderColor: bandColor + "40",
                    backgroundColor: bandColor + "15",
                  }}
                >
                  {band}
                </span>
              </div>

              {/* Predicted Values */}
              <div className="space-y-2">
                <div>
                  <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                    Predicted PM2.5
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-bold font-mono" style={{ color: bandColor }}>
                      {Math.round(forecast.pm25)}
                    </span>
                    <span className="text-xs text-slate-400">µg/m³</span>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                    Predicted AQI
                  </div>
                  <span className="text-lg font-bold font-mono text-slate-200">
                    {forecast.aqi}
                  </span>
                </div>
              </div>

              {/* Confidence Interval */}
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-[9px] font-mono text-slate-500 uppercase tracking-wider mb-1">
                  95% Confidence Interval
                </div>
                <div className="text-sm font-mono text-slate-200">
                  {Math.round(forecast.ciLow)} – {Math.round(forecast.ciHigh)}{" "}
                  <span className="text-slate-400">µg/m³</span>
                </div>
              </div>

              {/* Baseline Comparison */}
              <div className="space-y-1.5 text-xs font-mono">
                <div className="flex justify-between text-slate-400">
                  <span>vs Persistence</span>
                  <span
                    className={
                      persistDiff > 0 ? "text-red-400" : persistDiff < 0 ? "text-emerald-400" : "text-slate-400"
                    }
                  >
                    {persistDiff > 0 ? "+" : ""}
                    {persistDiff} µg/m³
                  </span>
                </div>
                {camsDiff !== null && (
                  <div className="flex justify-between text-slate-400">
                    <span>vs CAMS</span>
                    <span
                      className={
                        camsDiff > 0 ? "text-red-400" : camsDiff < 0 ? "text-emerald-400" : "text-slate-400"
                      }
                    >
                      {camsDiff > 0 ? "+" : ""}
                      {camsDiff} µg/m³
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Horizon Bar Chart */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5">
        <h3 className="text-sm font-semibold text-slate-200 mb-3">
          AQI Comparison Across Horizons
        </h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="horizon"
                tick={{ fill: "#64748b", fontSize: 11, fontFamily: "monospace" }}
                axisLine={{ stroke: "#1e293b" }}
              />
              <YAxis
                tick={{ fill: "#64748b", fontSize: 11, fontFamily: "monospace" }}
                axisLine={{ stroke: "#1e293b" }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0f172a",
                  border: "1px solid #1e293b",
                  borderRadius: "8px",
                  color: "#e2e8f0",
                  fontFamily: "monospace",
                  fontSize: "12px",
                }}
              />
              <Legend wrapperStyle={{ fontSize: "11px", fontFamily: "monospace" }} />
              <Bar dataKey="vaayuAqi" fill="#14b8a6" name="VAAYU AQI" radius={[4, 4, 0, 0]} />
              <Bar
                dataKey="persistence"
                fill="#475569"
                name="Persistence"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
