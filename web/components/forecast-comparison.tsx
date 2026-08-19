"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Forecast } from "@/lib/schemas";

export function ForecastComparison({ forecasts }: { forecasts: Forecast[] }) {
  const data = forecasts.map((forecast) => ({
    horizon: `${forecast.horizonHours}h`,
    model: forecast.pm25,
    persistence: forecast.baselinePersistence,
    cams: forecast.baselineCams,
  }));

  return (
    <div className="h-72 rounded-lg border bg-white p-3">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <XAxis dataKey="horizon" />
          <YAxis unit=" µg/m³" />
          <Tooltip />
          <Line type="monotone" dataKey="model" stroke="#0f766e" strokeWidth={3} name="Model" />
          <Line type="monotone" dataKey="persistence" stroke="#64748b" name="Persistence" />
          <Line type="monotone" dataKey="cams" stroke="#a16207" strokeDasharray="5 5" name="CAMS" connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
