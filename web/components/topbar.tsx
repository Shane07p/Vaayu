"use client";

import Link from "next/link";
import { SourceBadge } from "./source-badge";

interface TopbarProps {
  dataMode?: string;
  lastUpdated?: string;
}

export function Topbar({ dataMode = "CACHED", lastUpdated = "Operational" }: TopbarProps) {
  return (
    <header className="sticky top-0 z-30 h-14 bg-[#070a0e]/80 backdrop-blur-xl border-b border-white/10 px-6 flex items-center justify-between">
      {/* Left: Operational Context */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="font-mono text-xs font-semibold text-slate-200 tracking-wide">
            DELHI-NCR PILOT COMMAND
          </span>
        </div>
        <div className="h-4 w-[1px] bg-white/10 hidden sm:block" />
        <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-slate-400">
          <span>Mode:</span>
          <SourceBadge source={dataMode} />
        </div>
      </div>

      {/* Right: Telemetry & Actions */}
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="hidden md:flex items-center gap-3 text-xs font-mono text-slate-400">
          <span className="text-slate-500">Telemetry:</span>
          <span className="flex items-center gap-1.5 text-slate-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Live Sync
          </span>
          <span className="text-slate-600">•</span>
          <span className="text-slate-400">{lastUpdated}</span>
        </div>

        <div className="h-4 w-[1px] bg-white/10 hidden md:block" />

        <div className="flex items-center gap-2">
          <Link
            href="/aqi"
            target="_blank"
            className="px-3 py-1 text-xs font-mono rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 border border-white/10 transition-all flex items-center gap-1.5"
            title="Open Citizen Surface"
          >
            <span>Citizen UI</span>
            <span className="text-slate-500">↗</span>
          </Link>
          <div className="px-2.5 py-1 text-xs font-mono rounded-xl bg-white/[0.04] text-slate-300 border border-white/10 hidden lg:block">
            Statutory Loop: GRAP Active
          </div>
        </div>
      </div>
    </header>
  );
}
