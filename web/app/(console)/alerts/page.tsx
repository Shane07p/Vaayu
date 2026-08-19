import { SourceBadge } from "@/components/source-badge";
import { fetchAlerts } from "@/lib/api";
import type { Alert } from "@/lib/schemas";

export default async function AlertsPage() {
  let alerts: Alert[] = [];
  try {
    alerts = await fetchAlerts();
  } catch {
    // A missing source must not be rendered as an alert history.
  }

  return (
    <main className="mx-auto max-w-5xl space-y-5 p-6">
      <h1 className="text-2xl font-semibold">Alerts</h1>
      <p className="text-sm text-slate-600">Every alert names a statute, jurisdiction, and action.</p>
      <div className="space-y-4">
        {alerts.map((alert) => (
          <article key={alert.alertId} className="space-y-3 rounded-lg border bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm text-slate-600">{alert.alertId} · {alert.horizonHours} hour horizon</p><h2 className="text-xl font-semibold">GRAP Stage {alert.recommendedGrapStage} · predicted AQI {alert.predictedAqi}</h2></div><SourceBadge source={alert.source} /></div>
            <p>Forecast interval: AQI {alert.ciLow}–{alert.ciHigh}. Model: {alert.modelVersion}.</p>
            <p className="font-medium">Statutory basis: {alert.statutoryBasis}</p>
            <div><p className="text-sm font-medium text-slate-600">Jurisdiction</p><p>{alert.jurisdiction.join(", ")}</p></div>
            <div><p className="text-sm font-medium text-slate-600">Mandated actions</p><ul className="list-disc pl-5">{alert.mandatedActions.map((action) => <li key={action}>{action.replaceAll("_", " ")}</li>)}</ul></div>
            <p className="text-sm text-slate-600">Evidence: {alert.evidenceSources.join(", ")}</p>
          </article>
        ))}
      </div>
      {!alerts.length && <p className="rounded border border-amber-300 bg-amber-50 p-4 text-sm">No issued alerts are available.</p>}
    </main>
  );
}
