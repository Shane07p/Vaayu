import Link from "next/link";
import { AtmosphericBackground } from "@/components/citizen/atmospheric-background";

const PIPELINE_STEPS = [
  { code: "01", label: "OBSERVE", detail: "CPCB ground stations + Sentinel/MODIS AOD" },
  { code: "02", label: "ESTIMATE", detail: "1 km hyper-local PM2.5 surface via XGBoost" },
  { code: "03", label: "FORECAST", detail: "6h / 24h / 72h spike prediction" },
  { code: "04", label: "ATTRIBUTE", detail: "FIRMS fire clusters + wind trajectory" },
  { code: "05", label: "ALERT", detail: "GRAP stage classification + statutory basis" },
  { code: "06", label: "ACT", detail: "Direction-95 enforcement + DM worklist" },
];

const CAPABILITIES = [
  {
    title: "1 km Intelligence",
    description:
      "Hyper-local PM2.5 surface estimation beyond sparse monitoring stations. Quantile regression reports q10/q50/q90 — never a naked point estimate.",
    metric: "1 km",
    metricLabel: "grid resolution",
  },
  {
    title: "72h Forecast",
    description:
      "Forecast pollution spikes against persistence and CAMS baselines. Confidence intervals expose model uncertainty rather than hiding it.",
    metric: "72h",
    metricLabel: "forecast horizon",
  },
  {
    title: "Statutory Action",
    description:
      "Translate forecast risk into GRAP stages, mandated actions, jurisdiction assignments, and Direction-95 enforcement eligibility.",
    metric: "GRAP",
    metricLabel: "enforcement loop",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[#070a0e] text-slate-100 font-sans antialiased selection:bg-white/20 selection:text-white">
      {/* 1. Hero Section with Atmospheric Blurred Background */}
      <section className="relative flex flex-col items-center justify-center min-h-[92vh] px-6 py-20 overflow-hidden">
        <AtmosphericBackground imageSrc="/backgrounds/summer.jpg" overlayOpacity={0.85} blur={24} />

        <div className="relative z-10 max-w-4xl mx-auto text-center space-y-8 animate-fade-in">
          {/* Brand Mark */}
          <div className="inline-flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-white/[0.06] border border-white/15 flex items-center justify-center text-slate-200 shadow-lg">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2" />
                <path d="M9.6 4.6A2 2 0 1 1 11 8H2" />
                <path d="M12.6 19.4A2 2 0 1 0 14 16H2" />
              </svg>
            </div>
            <span className="font-mono text-2xl md:text-3xl font-bold tracking-[0.2em] text-white">
              VAAYU
            </span>
          </div>

          <div>
            <p className="text-[11px] font-mono uppercase tracking-[0.35em] text-slate-400">
              Air Quality Intelligence System
            </p>
          </div>

          {/* Hero Copy */}
          <div className="space-y-4 max-w-3xl mx-auto">
            <h1 className="text-3xl md:text-5xl font-bold leading-tight text-white tracking-tight">
              Forecast-driven air quality intelligence{" "}
              <span className="text-slate-300 font-medium">
                that terminates in statutory action.
              </span>
            </h1>
            <p className="text-base md:text-lg text-slate-300 leading-relaxed max-w-2xl mx-auto font-sans">
              VAAYU estimates hyper-local PM2.5 at 1 km resolution, forecasts pollution
              spikes up to 72 hours ahead, attributes likely fire sources, and converts
              forecasts into legally mapped action for authorities.
            </p>
          </div>

          {/* CTAs with smooth hover microinteractions */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <Link
              href="/map"
              className="group inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-white text-slate-950 font-mono font-bold text-xs tracking-wider transition-all duration-300 hover:bg-slate-200 shadow-[0_4px_20px_rgba(255,255,255,0.15)] hover:shadow-[0_6px_30px_rgba(255,255,255,0.25)] hover:-translate-y-0.5"
            >
              <span>Open Authority Console</span>
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </Link>
            <Link
              href="/aqi"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 font-mono font-medium text-xs tracking-wider border border-white/15 transition-all duration-300 backdrop-blur-md hover:-translate-y-0.5"
            >
              Check My Air
            </Link>
          </div>

          {/* Delhi-NCR Pilot Indicator */}
          <div className="flex items-center justify-center gap-2 pt-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-subtle-pulse" />
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
              Delhi-NCR Pilot · Operational
            </span>
          </div>
        </div>
      </section>

      {/* 2. Pipeline Section with Atmospheric Backdrop */}
      <section className="relative px-6 py-20 border-t border-white/10 overflow-hidden">
        <AtmosphericBackground imageSrc="/backgrounds/rain.jpeg" overlayOpacity={0.90} blur={26} />

        <div className="relative z-10 max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-slate-400 mb-2">
              End-to-End Decision Pipeline
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              From observation to statutory enforcement
            </h2>
            <p className="text-sm text-slate-300 mt-2 max-w-xl mx-auto font-sans">
              Every step is traceable. Every prediction carries uncertainty. Every alert names
              a statute, a jurisdiction, and a mandated action.
            </p>
          </div>

          {/* Pipeline Steps Cards with smooth hover */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {PIPELINE_STEPS.map((step, idx) => (
              <div
                key={step.code}
                className="group relative p-4 rounded-2xl bg-white/[0.04] border border-white/10 hover:border-white/25 transition-all duration-300 hover:bg-white/[0.08] hover:-translate-y-1 backdrop-blur-md"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono text-slate-500">{step.code}</span>
                  {idx < PIPELINE_STEPS.length - 1 && (
                    <span className="hidden lg:block text-slate-600 font-mono font-bold text-xs">→</span>
                  )}
                </div>
                <div className="text-xs font-bold font-mono tracking-wider text-slate-100 group-hover:text-white transition-colors">
                  {step.label}
                </div>
                <p className="mt-1 text-[11px] text-slate-400 leading-relaxed font-sans">
                  {step.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. Capabilities Section with Atmospheric Clouds Background */}
      <section className="relative px-6 py-20 border-t border-white/10 overflow-hidden">
        <AtmosphericBackground imageSrc="/backgrounds/normal.png" overlayOpacity={0.92} blur={24} />

        <div className="relative z-10 max-w-5xl mx-auto">
          <div className="grid md:grid-cols-3 gap-5">
            {CAPABILITIES.map((cap) => (
              <div
                key={cap.title}
                className="group p-6 rounded-3xl bg-white/[0.04] border border-white/10 hover:border-white/20 transition-all duration-300 hover:-translate-y-1 backdrop-blur-md"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="text-2xl font-mono font-bold text-white tracking-tight">
                    {cap.metric}
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                    {cap.metricLabel}
                  </span>
                </div>
                <h3 className="text-base font-semibold text-white mb-2">{cap.title}</h3>
                <p className="text-sm text-slate-300 leading-relaxed font-sans">{cap.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-10 border-t border-white/10">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-slate-500">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-slate-400">VAAYU</span>
            <span>·</span>
            <span>Google AI Hackathon 2026</span>
          </div>
          <div className="text-center sm:text-right">
            <p>Not affiliated with CPCB, CAQM, ISRO, or any government body.</p>
            <p className="text-slate-600 mt-1">Decision support, not official measurements.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
