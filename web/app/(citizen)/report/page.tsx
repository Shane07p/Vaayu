import { CitizenReportForm } from "@/components/citizen-report-form";
import { AtmosphericBackground } from "@/components/citizen/atmospheric-background";

export default function ReportPage() {
  return (
    <div className="space-y-6">
      {/* Header Card with Atmospheric Background */}
      <div className="relative rounded-3xl border border-white/10 overflow-hidden shadow-2xl p-6 sm:p-8 space-y-3">
        <AtmosphericBackground imageSrc="/backgrounds/normal.png" overlayOpacity={0.88} blur={22} />
        <div className="text-[10px] font-mono uppercase tracking-widest text-teal-400 font-semibold">
          Community Observation Intake
        </div>
        <h1 className="text-2xl font-mono font-bold text-slate-100 tracking-tight">
          See something that affects the air?
        </h1>
        <p className="text-xs text-slate-300 leading-relaxed font-sans max-w-xl">
          Report a local ground-level observation to help VAAYU understand conditions beyond sparse monitoring stations. Satellites can miss evening burning; citizen observations help bridge temporal gaps.
        </p>
      </div>

      {/* Form Area */}
      <CitizenReportForm />

      {/* Scientific Limitation Disclaimer */}
      <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-4 space-y-1.5 text-xs font-mono text-slate-400">
        <div className="text-slate-300 font-semibold uppercase tracking-wider text-[10px]">
          Important Scientific Limitation
        </div>
        <p className="leading-relaxed text-[11px]">
          Photographic classification produces an ordinal AQI band (Good / Moderate / Poor / Severe), never a microgram-per-cubic-meter concentration. The system never fabricates numeric PM2.5 readings from camera pixels.
        </p>
      </div>
    </div>
  );
}
