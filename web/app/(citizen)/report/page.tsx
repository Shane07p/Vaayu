"use client";
import { CitizenReportForm } from "@/components/citizen-report-form";
import { AtmosphericBackground } from "@/components/citizen/atmospheric-background";
import { useCitizenI18n } from "@/lib/i18n";

export default function ReportPage() {
  const { t } = useCitizenI18n();
  return (
    <div className="space-y-6">
      {/* Header Card with Atmospheric Background */}
      <div className="relative rounded-3xl border border-white/10 overflow-hidden shadow-2xl p-6 sm:p-8 space-y-3">
        <AtmosphericBackground imageSrc="/backgrounds/normal.png" overlayOpacity={0.88} blur={22} />
        <div className="text-[10px] font-mono uppercase tracking-widest text-teal-400 font-semibold">
          {t.reportTitle}
        </div>
        <h1 className="text-2xl font-mono font-bold text-slate-100 tracking-tight">
          {t.reportHeading}
        </h1>
        <p className="text-xs text-slate-300 leading-relaxed font-sans max-w-xl">
          {t.reportDescription}
        </p>
      </div>

      {/* Form Area */}
      <CitizenReportForm />

      {/* Scientific Limitation Disclaimer */}
      <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-4 space-y-1.5 text-xs font-mono text-slate-400">
        <div className="text-slate-300 font-semibold uppercase tracking-wider text-[10px]">
          {t.limitation}
        </div>
        <p className="leading-relaxed text-[11px]">
          {t.limitationText}
        </p>
      </div>
    </div>
  );
}
