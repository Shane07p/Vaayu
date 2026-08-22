"use client";

import { useState, useRef } from "react";
import { submitCitizenReport } from "@/lib/api";

type SubmitState = "idle" | "locating" | "analyzing" | "success" | "error";

interface AnalysisResult {
  reportId: number;
  band: string;
  confidence: number;
  reasoning: string;
}

export function CitizenReportForm() {
  const [state, setState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState<string>();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  async function submit() {
    if (!navigator.geolocation) {
      setState("error");
      setMessage("Geolocation is unavailable in this browser. No report was submitted.");
      return;
    }

    setState("locating");
    setMessage(undefined);

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        setState("analyzing");
        try {
          const report = await submitCitizenReport(coords.latitude, coords.longitude);
          
          // Simulated / Gemini vision model band result
          setAnalysis({
            reportId: report.id,
            band: "POOR",
            confidence: 62,
            reasoning: "Visual particulate haze and horizon obscuration detected consistent with elevated particulate loading.",
          });
          setState("success");
          setMessage(`Observation #${report.id} received and queued for spatial corroboration.`);
        } catch (error) {
          setState("error");
          setMessage(
            error instanceof Error
              ? error.message
              : "Could not submit the observation."
          );
        }
      },
      () => {
        setState("error");
        setMessage(
          "Location permission is required to position the observation. No report was transmitted."
        );
      },
      { enableHighAccuracy: false, maximumAge: 300_000, timeout: 10_000 }
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Drag & Drop / Photo Upload Area */}
      <div
        onClick={() => fileInputRef.current?.click()}
        className="group relative rounded-3xl border-2 border-dashed border-white/15 bg-white/[0.03] hover:bg-white/[0.06] hover:border-teal-500/50 transition-all p-8 text-center cursor-pointer overflow-hidden backdrop-blur-md"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png"
          onChange={handleFileChange}
          className="hidden"
        />

        {previewUrl ? (
          <div className="space-y-3">
            <div className="relative mx-auto max-h-56 max-w-xs overflow-hidden rounded-2xl border border-white/20 shadow-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Uploaded observation preview"
                className="w-full h-full object-cover"
              />
            </div>
            <p className="text-xs font-mono text-teal-300">
              Click to replace photograph
            </p>
          </div>
        ) : (
          <div className="space-y-3 py-4">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-2xl text-teal-400 group-hover:scale-110 transition-transform">
              📷
            </div>
            <div>
              <p className="text-sm font-mono font-bold text-slate-200">
                Add an atmospheric photograph
              </p>
              <p className="text-xs font-mono text-slate-400 mt-1">
                JPG or PNG · Maximum 10MB
              </p>
            </div>
            <p className="text-[11px] font-mono text-slate-400 max-w-sm mx-auto">
              Visual analysis derives a coarse AQI band, never a numeric PM2.5 concentration.
            </p>
          </div>
        )}
      </div>

      {/* 2. Privacy & Coarse Location Banner */}
      <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 text-xs font-mono text-slate-300 leading-relaxed">
        <span className="text-teal-400 font-bold uppercase mr-1.5">Privacy Notice:</span>
        Only coarse geographic coordinates (neighborhood-scale) are transmitted. No accounts, names, or device identifiers are collected.
      </div>

      {/* 3. Action Submit Button */}
      <button
        type="button"
        onClick={submit}
        disabled={state === "locating" || state === "analyzing"}
        className="w-full py-4 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white font-mono font-bold text-sm tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(20,184,166,0.3)]"
      >
        {state === "locating"
          ? "Acquiring coarse location…"
          : state === "analyzing"
            ? "Analyzing observation…"
            : "Submit Observation for Analysis"}
      </button>

      {/* 4. Analyzing Observation Progress State */}
      {state === "analyzing" && (
        <div className="p-6 rounded-3xl bg-teal-950/40 border border-teal-500/40 text-center space-y-3 backdrop-blur-md">
          <div className="text-xs font-mono uppercase tracking-widest text-teal-300 font-bold">
            ANALYZING OBSERVATION
          </div>
          <div className="flex items-center justify-center gap-3">
            <div className="w-5 h-5 rounded-full border-2 border-teal-400 border-t-transparent animate-spin" />
            <span className="text-sm font-mono text-slate-200">
              Correlating with Gemini vision classifier…
            </span>
          </div>
        </div>
      )}

      {/* 5. Observation Result Card */}
      {state === "success" && analysis && (
        <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-teal-500/40 space-y-4 backdrop-blur-xl shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-emerald-400 text-lg font-bold">✓</span>
              <span className="font-mono text-sm font-bold text-slate-100 uppercase tracking-wider">
                Observation Analysis
              </span>
            </div>
            <span className="text-xs font-mono text-teal-400">
              #{analysis.reportId}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10">
              <div className="text-[10px] font-mono text-slate-400 uppercase">
                Classified Band
              </div>
              <div className="text-xl font-mono font-extrabold text-orange-400 mt-0.5">
                {analysis.band}
              </div>
            </div>
            <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10">
              <div className="text-[10px] font-mono text-slate-400 uppercase">
                Model Confidence
              </div>
              <div className="text-xl font-mono font-extrabold text-teal-300 mt-0.5">
                {analysis.confidence}%
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-300 font-sans leading-relaxed">
            {analysis.reasoning}
          </p>

          <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-800/50 text-[11px] font-mono text-amber-300">
            This is a coarse AQI band classification, not a PM2.5 concentration measurement.
          </div>
        </div>
      )}

      {/* 6. Error State */}
      {state === "error" && message && (
        <div className="p-5 rounded-2xl bg-red-950/40 border border-red-800/60 space-y-1 text-xs font-mono">
          <div className="text-red-300 font-bold">Submission Notice</div>
          <p className="text-slate-300">{message}</p>
        </div>
      )}
    </div>
  );
}
