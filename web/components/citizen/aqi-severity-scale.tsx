"use client";

interface AqiSeverityScaleProps {
  aqi: number;
  className?: string;
}

const SEGMENTS = [
  { label: "GOOD", min: 0, max: 50, color: "#10b981", activeBg: "bg-emerald-500" },
  { label: "MODERATE", min: 51, max: 100, color: "#eab308", activeBg: "bg-yellow-500" },
  { label: "POOR", min: 101, max: 200, color: "#f97316", activeBg: "bg-orange-500" },
  { label: "SEVERE", min: 201, max: 300, color: "#ef4444", activeBg: "bg-red-500" },
  { label: "HAZARDOUS", min: 301, max: 500, color: "#a855f7", activeBg: "bg-purple-500" },
];

export function AqiSeverityScale({ aqi, className = "" }: AqiSeverityScaleProps) {
  // Clamp AQI for percentage positioning (0 - 500 scale)
  const clampedAqi = Math.max(0, Math.min(500, aqi));
  const percent = (clampedAqi / 500) * 100;

  // Determine active segment color
  let activeColor = "#f97316";
  if (aqi <= 50) activeColor = "#10b981";
  else if (aqi <= 100) activeColor = "#eab308";
  else if (aqi <= 200) activeColor = "#f97316";
  else if (aqi <= 300) activeColor = "#ef4444";
  else activeColor = "#a855f7";

  return (
    <div className={`w-full space-y-2.5 select-none ${className}`}>
      {/* Top Labels */}
      <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 uppercase tracking-wider">
        <span>Scale Severity</span>
        <span className="font-semibold text-slate-200">
          Position: {aqi} AQI
        </span>
      </div>

      {/* Segmented Track Container */}
      <div className="relative pt-2 pb-1">
        {/* Track Bar with 5 Distinct Segments */}
        <div className="grid grid-cols-5 gap-1.5 h-2.5 rounded-full overflow-hidden bg-slate-900/80 p-0.5 border border-white/10 backdrop-blur-sm">
          {SEGMENTS.map((seg) => {
            const isCurrent = aqi >= seg.min && (seg.max === 500 ? aqi >= seg.min : aqi <= seg.max);
            return (
              <div
                key={seg.label}
                className="relative h-full rounded-full transition-opacity duration-300"
                style={{
                  backgroundColor: seg.color,
                  opacity: isCurrent ? 0.95 : 0.25,
                }}
              />
            );
          })}
        </div>

        {/* Dynamic Position Pin / Glowing Indicator */}
        <div
          className="absolute top-1 -translate-x-1/2 transition-all duration-700 ease-out pointer-events-none"
          style={{ left: `${percent}%` }}
        >
          {/* Outer glow ring */}
          <div
            className="w-4 h-4 rounded-full border-2 border-white shadow-lg flex items-center justify-center animate-pulse"
            style={{
              backgroundColor: activeColor,
              boxShadow: `0 0 14px ${activeColor}, 0 0 4px #ffffff`,
            }}
          >
            <div className="w-1 h-1 rounded-full bg-white" />
          </div>
        </div>
      </div>

      {/* Segment Names & Ticks */}
      <div className="grid grid-cols-5 text-center text-[9px] font-mono tracking-wider text-slate-400">
        <div>GOOD</div>
        <div>MODERATE</div>
        <div>POOR</div>
        <div>SEVERE</div>
        <div>HAZARDOUS</div>
      </div>

      {/* Numerical Labels */}
      <div className="flex justify-between text-[10px] font-mono text-slate-400 px-0.5 pt-0.5">
        <span>0</span>
        <span>50</span>
        <span>100</span>
        <span>200</span>
        <span>300</span>
        <span>500+</span>
      </div>
    </div>
  );
}
