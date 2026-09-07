"use client";

import Link from "next/link";

interface TopbarProps {
  /**
   * When the newest live feed last ran, already formatted.
   *
   * Null when nothing has run or provenance could not be read, and the line is
   * then omitted rather than filled in. This defaulted to the literal string
   * "40 minutes ago" and the only caller passed nothing, so every console page
   * claimed a freshness it had never checked. That is the same defect as the
   * hardcoded "Updated: 22 AUG 2026 · 14:51 IST" removed from the citizen hero,
   * and harder to catch: a relative phrase always reads as current, where an
   * absolute timestamp eventually looks obviously wrong.
   */
  lastUpdated?: string | null;
}

export function Topbar({ lastUpdated = null }: TopbarProps) {
  return (
    <header className="sticky top-0 z-30 h-14 bg-[#070a0e]/80 backdrop-blur-xl border-b border-white/10 px-6 flex items-center justify-between">
      {/* Left: Region Context */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="font-mono text-xs font-semibold text-slate-200 tracking-wide">
            Delhi NCR
          </span>
        </div>
        {lastUpdated && (
          <>
            <div className="h-4 w-[1px] bg-white/10 hidden sm:block" />
            <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-slate-400">
              <span>Last updated {lastUpdated}</span>
            </div>
          </>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-2">
          <Link
            href="/aqi"
            target="_blank"
            className="px-3 py-1 text-xs font-mono rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 border border-white/10 transition-all flex items-center gap-1.5"
            title="Open citizen view"
          >
            <span>Citizen view</span>
            <span className="text-slate-500">↗</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
