"use client";

interface CitizenGuidanceProps {
  aqi: number;
}

export function CitizenGuidance({ aqi }: CitizenGuidanceProps) {
  let band = "POOR";
  let explanation = "Pollution levels are elevated. The 1 km model estimate indicates degraded air quality across your immediate area.";
  let guidance = [
    "Prefer lower-exposure outdoor activity during peak traffic hours.",
    "Consider reducing prolonged outdoor exertion if sensitive to particulates.",
    "Keep indoor spaces ventilated with air purifiers where available.",
    "Check the 24-hour forecast before planning extensive outdoor workouts.",
  ];

  if (aqi <= 50) {
    band = "GOOD";
    explanation = "Air quality is satisfactory and poses minimal risk across all demographic groups.";
    guidance = [
      "Ideal conditions for outdoor sports, recreation, and natural ventilation.",
      "No special precautions required.",
      "Open windows to refresh indoor air.",
    ];
  } else if (aqi <= 100) {
    band = "MODERATE";
    explanation = "Air quality is acceptable; however, minor breathing discomfort may affect unusually sensitive individuals.";
    guidance = [
      "Safe for general outdoor activities.",
      "Unusually sensitive individuals should monitor personal comfort during prolonged exertion.",
      "Track local forecast if planning evening travel.",
    ];
  } else if (aqi <= 200) {
    band = "POOR";
    explanation = "Pollution levels are elevated. The 1 km model estimate indicates degraded air quality across your immediate area.";
    guidance = [
      "Prefer lower-exposure outdoor activity during peak traffic hours.",
      "Consider reducing prolonged outdoor exertion if sensitive to particulates.",
      "Keep indoor spaces ventilated with air purifiers where available.",
      "Check the 24-hour forecast before planning outdoor activities.",
    ];
  } else if (aqi <= 300) {
    band = "SEVERE";
    explanation = "Air quality is severely compromised. Particulate concentrations may cause respiratory effects on the general population.";
    guidance = [
      "Avoid strenuous outdoor activities and prolonged exposure.",
      "Wear particulate-filtering masks (N95/FFP2) when commuting outdoors.",
      "Keep windows and doors securely closed; operate HEPA filtration.",
      "Children, seniors, and asthmatics should remain indoors in protected spaces.",
    ];
  } else {
    band = "HAZARDOUS";
    explanation = "Emergency air quality conditions. Significant health hazard to the entire population with pronounced respiratory stress.";
    guidance = [
      "Avoid all non-essential outdoor movement.",
      "Seal interior living areas and maintain continuous air purification.",
      "Strict statutory GRAP Stage IV emergency measures apply across the region.",
      "Seek prompt medical advice if experiencing persistent breathlessness.",
    ];
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-6 sm:p-8 space-y-6">
      {/* What This Means Section */}
      <div className="space-y-2">
        <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400 font-semibold">
          What This Means
        </div>
        <h2 className="text-lg font-mono font-bold text-slate-100">
          Air quality is currently <span className="text-teal-300">{band}</span>
        </h2>
        <p className="text-sm text-slate-300 leading-relaxed font-sans">
          {explanation}
        </p>
      </div>

      {/* Today's Guidance Section */}
      <div className="pt-4 border-t border-white/10 space-y-3">
        <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400 font-semibold">
          Today&apos;s Actionable Guidance
        </div>
        <div className="space-y-2.5">
          {guidance.map((item, index) => (
            <div
              key={index}
              className="flex items-start gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/5 text-sm text-slate-200"
            >
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-[10px] font-mono font-bold text-teal-400 mt-0.5">
                {index + 1}
              </span>
              <span className="leading-snug">{item}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
