// web/components/citizen/IntelligencePanel.tsx
"use client";

import React from 'react';
import { useAQIStore } from '@/store/aqiStore';
import { CitizenHero } from '@/components/citizen/citizen-hero';
import { CitizenGuidance } from '@/components/citizen/citizen-guidance';
import { CitizenForecast } from '@/components/citizen/citizen-forecast';

function getAqiFromPm25(pm25: number): number {
  if (pm25 <= 30) return Math.round((pm25 / 30) * 50);
  if (pm25 <= 60) return Math.round(50 + ((pm25 - 30) / 30) * 50);
  if (pm25 <= 90) return Math.round(100 + ((pm25 - 60) / 30) * 100);
  if (pm25 <= 120) return Math.round(200 + ((pm25 - 90) / 30) * 100);
  if (pm25 <= 250) return Math.round(300 + ((pm25 - 120) / 130) * 100);
  return Math.min(500, Math.round(400 + ((pm25 - 250) / 150) * 100));
}

/**
 * Citizen intelligence panel displaying telemetry, guidance, and forecast.
 */
const IntelligencePanel: React.FC = () => {
  const { selectedCellData, forecast } = useAQIStore();

  const pm25 = selectedCellData ? Math.round(selectedCellData.pm25Q50) : 182;
  const aqi = getAqiFromPm25(pm25);

  return (
    <div className="space-y-6 animate-fade-in text-slate-100">
      <CitizenHero initialEstimate={selectedCellData ?? undefined} />
      <CitizenGuidance aqi={aqi} />
      <CitizenForecast currentAqi={aqi} forecasts={forecast} />
    </div>
  );
};

export default IntelligencePanel;

