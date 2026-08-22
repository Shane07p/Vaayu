// web/components/citizen/MapControls.tsx
import React from 'react';

/**
 * Minimal top‑right control bar for the map.
 * Matches the design spec: dark translucent background with subtle border.
 */
const MapControls: React.FC = () => {
  return (
    <div className="map-controls absolute top-4 right-4 flex items-center space-x-2 px-3 py-1.5 rounded-md bg-map-control-bg border border-map-control-border backdrop-blur-md">
      <span className="text-sm font-medium text-map-control-text">AQI Map</span>
      <button className="focus:outline-none" title="Toggle fullscreen">
        {/* simple fullscreen Unicode symbol */}
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-map-control-text" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 3H5a2 2 0 00-2 2v3m0 8v3a2 2 0 002 2h3m8-18h3a2 2 0 012 2v3m0 8v3a2 2 0 01-2 2h-3" />
        </svg>
      </button>
    </div>
  );
};

export default MapControls;
