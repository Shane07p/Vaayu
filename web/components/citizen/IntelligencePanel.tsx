// web/components/citizen/IntelligencePanel.tsx
"use client";

import React from 'react';
import { useAQIStore } from '@/store/aqiStore';
import { CitizenHero } from '@/components/citizen/citizen-hero';
import { CitizenGuidance } from '@/components/citizen/citizen-guidance';
import { CitizenForecast } from '@/components/citizen/citizen-forecast';

/**
 * Citizen intelligence panel displaying telemetry, guidance, and forecast.
 */
const IntelligencePanel: React.FC = () => {
  const { selectedCellData, forecast } = useAQIStore();

  // 182 and a locally computed AQI used to stand in when nothing was selected.
  // The API returns the CPCB value with the cell, so there is one implementation
  // of the statutory scale and no invented default.
  // Guidance and a forecast chart both need a current value. Without a selected
  // cell there isn't one, and the panel says so rather than defaulting to 182.
  if (!selectedCellData) {
    return (
      <div className="space-y-6 animate-fade-in text-slate-100">
        <CitizenHero />
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-xs font-mono text-slate-400">
          No estimate for this location yet. Select a place inside the covered
          area, or use your location, to see measured air quality.
        </div>
      </div>
    );
  }

  const aqi = selectedCellData.aqi;

  return (
    <div className="space-y-6 animate-fade-in text-slate-100">
      <CitizenHero initialEstimate={selectedCellData} />
      <CitizenGuidance aqi={aqi} />
      <CitizenForecast currentAqi={aqi} forecasts={forecast} />
    </div>
  );
};

export default IntelligencePanel;

