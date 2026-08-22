// web/components/citizen/IntelligencePanel.tsx
import React from 'react';
import { useAQIStore } from '@/store/aqiStore';
import AtmosphericBg from '@/components/citizen/AtmosphericBg';
import AQIWeatherTabs from '@/components/citizen/AQIWeatherTabs';
import AQIHero from '@/components/citizen/AQIHero';
import MetricRow from '@/components/citizen/MetricRow';
import AQIScale from '@/components/citizen/AQIScale';
import SourceBadge from '@/components/citizen/SourceBadge';
import Interpretation from '@/components/citizen/Interpretation';
import ForecastPreview from '@/components/citizen/ForecastPreview';
import ReportCTA from '@/components/citizen/ReportCTA';

/**
 * Floating panel that sits above the full‑screen map.
 * It displays AQI data, weather, forecast and source information.
 */
const IntelligencePanel: React.FC = () => {
  const { selectedCellData, currentTab, setTab } = useAQIStore();

  // Fallback values while data loads
  const aqi = selectedCellData?.aqi ?? '--';
  const pm25 = selectedCellData?.pm25Q50 ? Math.round(selectedCellData.pm25Q50) : '--';
  const pm10 = selectedCellData?.pm10Q50 ? Math.round(selectedCellData.pm10Q50) : '--';

  return (
    <div className="intelligence-panel fixed left-8 right-8 bottom-0 max-w-[1600px] mx-auto mb-4 rounded-t-3xl bg-panel-bg backdrop-blur-md p-6 lg:p-8 glass-panel">
      {/* Atmospheric background image – placeholder image name */}
      <AtmosphericBg imageSrc="/backgrounds/city.jpg" />

      <div className="relative z-10">
        {/* Header with location and controls */}
        <header className="flex justify-between items-center mb-4">
          <div className="text-sm text-muted">
            {/* Placeholder location – will be replaced with real data */}
            Gandhinagar, Gujarat, India<br />
            Last updated: {new Date().toLocaleString('en-GB', { hour12: false })}
          </div>
          <div className="flex space-x-3">
            <button className="btn-control" onClick={() => useAQIStore.getState().locateMe()}>Locate me</button>
            <button className="btn-control" title="Share">♡</button>
          </div>
        </header>

        {/* Tabs */}
        <AQIWeatherTabs activeTab={currentTab} onChange={setTab} />

        {/* Main content – AQI view */}
        {currentTab === 'aqi' && (
          <>
            <AQIHero aqi={aqi} />
            <MetricRow pm25={pm25} pm10={pm10} />
            <AQIScale aqi={typeof aqi === 'number' ? aqi : 0} />
            <SourceBadge source="LIVE" />
            <Interpretation aqi={aqi} />
          </>
        )}
        {/* Weather tab placeholder */}
        {currentTab === 'weather' && <div className="text-center py-8 text-muted">Weather information coming soon.</div>}

        {/* Forecast preview – always shown under AQI view */}
        <ForecastPreview />
        <ReportCTA />
      </div>
    </div>
  );
};

export default IntelligencePanel;
