"use client";

interface StatusStripProps {
  modelVersion?: string;
  source?: string;
  updatedAt?: string;
  className?: string;
}

export function StatusStrip({
  modelVersion = "VAAYU-XGB-v1",
  source = "CACHED",
  updatedAt = "Operational Cycle",
  className = "",
}: StatusStripProps) {
  const isCached = source === "SEED" || source === "FIXTURE" || source === "CACHED";

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-4 px-4 py-2.5 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md text-xs font-mono text-slate-300 ${className}`}
    >
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <span className="text-slate-500 uppercase tracking-wider text-[10px] font-bold">
          System Provenance
        </span>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-slate-400">Stations:</span>
          <span className="text-slate-200">CPCB Active</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isCached ? "bg-amber-400" : "bg-emerald-400"
            }`}
          />
          <span className="text-slate-400">Satellite:</span>
          <span className={isCached ? "text-amber-300 font-medium" : "text-slate-200"}>
            {isCached ? "Cached INSAT/MODIS" : "Live GEE Feed"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-slate-400">Fires:</span>
          <span className="text-slate-200">FIRMS VIIRS/MODIS</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-slate-400">Meteo:</span>
          <span className="text-slate-200">ERA5 / IMD GFS</span>
        </div>
      </div>

      <div className="flex items-center gap-4 text-slate-400">
        <div>
          <span className="text-slate-500">Model: </span>
          <span className="text-slate-200 font-semibold">{modelVersion}</span>
        </div>
        <div className="hidden sm:block text-slate-700">|</div>
        <div className="hidden sm:block">
          <span className="text-slate-500">Status: </span>
          <span className="text-slate-300">{updatedAt}</span>
        </div>
      </div>
    </div>
  );
}
