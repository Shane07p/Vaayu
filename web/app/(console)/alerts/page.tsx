import { SourceBadge } from "@/components/source-badge";
import { SeverityBadge } from "@/components/severity-badge";
import { StatusStrip } from "@/components/status-strip";
import { fetchAlerts } from "@/lib/api";
import type { Alert } from "@/lib/schemas";

function getGrapColor(stage: string): string {
  switch (stage) {
    case "I": return "border-emerald-700/60 bg-emerald-950/20";
    case "II": return "border-amber-700/60 bg-amber-950/20";
    case "III": return "border-orange-600/60 bg-orange-950/25";
    case "IV": return "border-red-600/80 bg-red-950/30 shadow-[0_0_20px_rgba(239,68,68,0.1)]";
    default: return "border-slate-800 bg-slate-950/60";
  }
}

function getGrapAccent(stage: string): string {
  switch (stage) {
    case "I": return "text-emerald-400";
    case "II": return "text-amber-400";
    case "III": return "text-orange-400";
    case "IV": return "text-red-400";
    default: return "text-slate-400";
  }
}

export default async function AlertsPage() {
  let alerts: Alert[] = [];
  try {
    alerts = await fetchAlerts();
  } catch {
    // A missing source must not be rendered as an alert history.
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-100 mb-1">
          Statutory Alerts
        </h1>
        <p className="text-sm text-slate-400">
          Every alert names a statute, jurisdiction, mandated actions, and GRAP stage.
          These are legally actionable packets, not notifications.
        </p>
      </div>

      <StatusStrip />

      {/* Alerts List */}
      {alerts.length > 0 ? (
        <div className="space-y-5">
          {alerts.map((alert) => (
            <article
              key={alert.alertId}
              className={`rounded-xl border ${getGrapColor(alert.recommendedGrapStage)} overflow-hidden`}
            >
              {/* Alert Header Bar */}
              <div className="p-5 space-y-4">
                {/* Top Row: ID + Source + Stage */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                        ALERT
                      </span>
                      <span className="text-sm font-mono font-bold text-slate-200">
                        {alert.alertId}
                      </span>
                      <SourceBadge source={alert.source} />
                    </div>
                    <div className="text-xs text-slate-400 font-mono">
                      Issued {new Date(alert.issuedAt).toLocaleString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "Asia/Kolkata",
                      })}{" "}
                      IST · {alert.horizonHours}h horizon
                    </div>
                  </div>
                  <SeverityBadge grapStage={alert.recommendedGrapStage} size="lg" />
                </div>

                {/* Key Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
                    <div className="text-[9px] font-mono uppercase text-slate-500 mb-0.5">
                      Predicted AQI
                    </div>
                    <div className={`text-2xl font-bold font-mono ${getGrapAccent(alert.recommendedGrapStage)}`}>
                      {alert.predictedAqi}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
                    <div className="text-[9px] font-mono uppercase text-slate-500 mb-0.5">
                      95% CI
                    </div>
                    <div className="text-lg font-bold font-mono text-slate-200">
                      {alert.ciLow}–{alert.ciHigh}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
                    <div className="text-[9px] font-mono uppercase text-slate-500 mb-0.5">
                      Forecast Horizon
                    </div>
                    <div className="text-lg font-bold font-mono text-slate-200">
                      {alert.horizonHours} hours
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
                    <div className="text-[9px] font-mono uppercase text-slate-500 mb-0.5">
                      Exposed Population
                    </div>
                    <div className="text-lg font-bold font-mono text-slate-200">
                      {alert.exposedPopulation
                        ? (alert.exposedPopulation / 1_000_000).toFixed(1) + "M"
                        : "—"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Statutory Basis */}
              <div className="px-5 py-4 border-t border-slate-800/60">
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-2">
                  Statutory Basis
                </div>
                <p className="text-sm text-slate-200 leading-relaxed">{alert.statutoryBasis}</p>
              </div>

              {/* Jurisdiction */}
              <div className="px-5 py-4 border-t border-slate-800/60">
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-2">
                  Jurisdiction
                </div>
                <div className="flex flex-wrap gap-2">
                  {alert.jurisdiction.map((j) => (
                    <span
                      key={j}
                      className="px-2.5 py-1 rounded-lg text-xs font-mono bg-slate-900 text-slate-300 border border-slate-800"
                    >
                      {j}
                    </span>
                  ))}
                </div>
              </div>

              {/* Mandated Actions */}
              <div className="px-5 py-4 border-t border-slate-800/60">
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-3">
                  Mandated Actions
                </div>
                <div className="space-y-2">
                  {alert.mandatedActions.map((action, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2.5 text-sm text-slate-200"
                    >
                      <span className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded flex items-center justify-center text-xs font-bold ${getGrapAccent(alert.recommendedGrapStage)} bg-slate-900 border border-slate-800`}>
                        ✓
                      </span>
                      <span>{action.replaceAll("_", " ")}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Evidence Sources */}
              <div className="px-5 py-4 border-t border-slate-800/60 bg-slate-900/30">
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-2">
                  Evidence Chain
                </div>
                <div className="flex flex-wrap gap-2">
                  {alert.evidenceSources.map((source) => (
                    <span
                      key={source}
                      className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800/60 text-slate-400 border border-slate-700/60"
                    >
                      {source}
                    </span>
                  ))}
                </div>
                <div className="mt-2 text-[10px] font-mono text-slate-500">
                  Model: {alert.modelVersion}
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-8 text-center space-y-2">
          <div className="text-sm font-mono text-slate-400 uppercase tracking-wider">
            No Active Statutory Alerts
          </div>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            No forecast currently meets the configured GRAP action threshold.
            Alerts are generated automatically when predicted AQI exceeds
            statutory exceedance levels.
          </p>
        </div>
      )}
    </div>
  );
}
