"use client";

import Link from "next/link";
import { AtmosphericBackground } from "./atmospheric-background";

export function TrustGrid() {
  return (
    <div className="space-y-6">
      {/* 1. How VAAYU Knows Section */}
      <div className="relative rounded-3xl border border-white/10 overflow-hidden shadow-2xl p-6 sm:p-8 space-y-6">
        {/* Atmospheric Blur Background (Clear Sky / Clouds image) */}
        <AtmosphericBackground imageSrc="/backgrounds/normal.png" overlayOpacity={0.86} blur={20} />

        <div className="border-b border-white/10 pb-4">
          <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400 font-semibold">
            Scientific Foundation
          </div>
          <h2 className="text-xl font-mono font-bold text-slate-100 mt-0.5">
            How VAAYU Knows
          </h2>
          <p className="text-xs text-slate-400 font-sans mt-1">
            VAAYU goes beyond sparse monitoring stations to estimate hyper-local air quality.
          </p>
        </div>

        {/* 3 Physical Glass Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-md space-y-2 hover:border-teal-500/40 transition-all">
            <div className="w-8 h-8 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 text-xs font-mono font-bold">
              1 km
            </div>
            <h3 className="text-sm font-mono font-bold text-slate-200">
              1 KM GRID
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              Continuous spatial PM2.5 estimation across every square kilometer, filling the gaps between isolated monitoring stations.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-md space-y-2 hover:border-teal-500/40 transition-all">
            <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 text-xs font-mono font-bold">
              MULTI
            </div>
            <h3 className="text-sm font-mono font-bold text-slate-200">
              MULTIPLE SOURCES
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              Ground-truth CPCB stations, Sentinel & MODIS aerosol optical depth, and high-resolution ERA5 meteorological reanalysis.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-md space-y-2 hover:border-teal-500/40 transition-all">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 text-xs font-mono font-bold">
              72H
            </div>
            <h3 className="text-sm font-mono font-bold text-slate-200">
              72H FORECAST
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              Ensemble spike prediction trained on leave-one-station-out validation to anticipate statutory exceedances before they occur.
            </p>
          </div>
        </div>
      </div>

      {/* 2. Citizen Report Call-to-Action Card */}
      <div className="relative rounded-3xl border border-teal-500/30 bg-teal-950/20 backdrop-blur-xl p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6 overflow-hidden">
        <div className="space-y-1.5 max-w-md">
          <div className="text-[10px] font-mono uppercase tracking-widest text-teal-400 font-semibold">
            Community Sensing
          </div>
          <h3 className="text-lg font-mono font-bold text-slate-100">
            See something unusual affecting the air?
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed font-sans">
            Report a local smoke or dust observation with a photograph. Satellites can miss evening burning; citizen reports help close the temporal gap.
          </p>
        </div>

        <Link
          href="/report"
          className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white font-mono font-semibold text-xs tracking-wider transition-all shadow-[0_0_20px_rgba(20,184,166,0.3)] flex-shrink-0"
        >
          <span>Report an observation</span>
          <span>→</span>
        </Link>
      </div>
    </div>
  );
}
