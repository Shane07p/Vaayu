"use client";

interface IntelligenceChainProps {
  activeStep?: "OBSERVE" | "ESTIMATE" | "FORECAST" | "ATTRIBUTE" | "ALERT" | "ACT";
  layout?: "horizontal" | "vertical" | "compact";
  className?: string;
}

const STEPS = [
  {
    key: "OBSERVE",
    label: "Observe",
    detail: "CPCB Stations + Sentinel/MODIS",
    code: "01",
  },
  {
    key: "ESTIMATE",
    label: "Estimate",
    detail: "1 km Hyper-Local PM2.5 Surface",
    code: "02",
  },
  {
    key: "FORECAST",
    label: "Forecast",
    detail: "6h / 24h / 72h Spike Prediction",
    code: "03",
  },
  {
    key: "ATTRIBUTE",
    label: "Attribute",
    detail: "Fire FRP & Downwind Trajectory",
    code: "04",
  },
  {
    key: "ALERT",
    label: "Alert",
    detail: "Statutory GRAP Classification",
    code: "05",
  },
  {
    key: "ACT",
    label: "Act",
    detail: "Direction-95 & DM Enforcement",
    code: "06",
  },
];

export function IntelligenceChain({
  activeStep,
  layout = "horizontal",
  className = "",
}: IntelligenceChainProps) {
  if (layout === "compact") {
    return (
      <div className={`flex items-center flex-wrap gap-1.5 font-mono text-[11px] ${className}`}>
        {STEPS.map((s, idx) => {
          const isActive = activeStep === s.key;
          return (
            <div key={s.key} className="flex items-center gap-1.5">
              <span
                className={`px-2 py-0.5 rounded border transition-colors ${
                  isActive
                    ? "bg-teal-950/90 text-teal-300 border-teal-500 font-bold shadow-[0_0_8px_rgba(20,184,166,0.3)]"
                    : "bg-slate-900/60 text-slate-400 border-slate-800"
                }`}
              >
                {s.label}
              </span>
              {idx < STEPS.length - 1 && (
                <span className="text-slate-600 font-bold">→</span>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  if (layout === "vertical") {
    return (
      <div className={`space-y-2 font-mono ${className}`}>
        <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-3">
          Operational Intelligence Chain
        </p>
        <div className="relative pl-5 border-l-2 border-slate-800 space-y-4">
          {STEPS.map((s) => {
            const isActive = activeStep === s.key;
            return (
              <div key={s.key} className="relative group">
                <div
                  className={`absolute -left-[27px] top-1 w-3.5 h-3.5 rounded-full border-2 ${
                    isActive
                      ? "bg-teal-400 border-teal-200 ring-4 ring-teal-500/20"
                      : "bg-slate-900 border-slate-700"
                  }`}
                />
                <div className="text-xs">
                  <span
                    className={`font-semibold tracking-wide ${
                      isActive ? "text-teal-300" : "text-slate-300"
                    }`}
                  >
                    {s.code}. {s.label}
                  </span>
                  <p className="text-[11px] text-slate-500 font-sans mt-0.5">{s.detail}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 ${className}`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-mono uppercase tracking-widest text-slate-400 font-semibold">
          End-to-End Decision Pipeline
        </span>
        <span className="text-[11px] font-mono text-teal-400/90 font-medium">
          Observation → Statutory Action
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        {STEPS.map((s, idx) => {
          const isActive = activeStep === s.key;
          return (
            <div
              key={s.key}
              className={`relative p-2.5 rounded-lg border transition-all ${
                isActive
                  ? "bg-teal-950/50 border-teal-500/70 text-slate-100 shadow-[0_0_15px_rgba(20,184,166,0.15)]"
                  : "bg-slate-950/40 border-slate-800/80 text-slate-400 hover:border-slate-700"
              }`}
            >
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 mb-1">
                <span>{s.code}</span>
                {idx < STEPS.length - 1 && (
                  <span className="hidden md:inline text-slate-600 font-bold">→</span>
                )}
              </div>
              <div
                className={`text-xs font-semibold tracking-wide ${
                  isActive ? "text-teal-300" : "text-slate-200"
                }`}
              >
                {s.label}
              </div>
              <div className="text-[10px] text-slate-400 font-sans mt-0.5 line-clamp-2">
                {s.detail}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
