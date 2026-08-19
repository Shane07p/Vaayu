import { SourceBadge } from "@/components/source-badge";
import { fetchGrid } from "@/lib/api";

export default async function AqiPage() {
  let estimate;
  try {
    estimate = (await fetchGrid("77.18,28.58,77.24,28.64"))[0];
  } catch {
    estimate = undefined;
  }

  return (
    <main className="mx-auto max-w-2xl space-y-5 p-6">
      <h1 className="text-2xl font-semibold">Air quality near you</h1>
      <p className="text-sm text-slate-600">
        Where there is no monitoring station nearby, this is a model estimate with stated uncertainty,
        not a measurement.
      </p>
      {estimate ? (
        <section className="space-y-3 rounded-lg border bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-slate-600">Current model estimate</p>
            <SourceBadge source={estimate.source} />
          </div>
          <p className="text-5xl font-semibold">
            {Math.round(estimate.pm25Q50)} <span className="text-lg font-normal">µg/m³</span>
          </p>
          <p>90% uncertainty interval: {Math.round(estimate.pm25Q10)}–{Math.round(estimate.pm25Q90)} µg/m³</p>
          <p className="text-sm text-slate-600">
            Satellite coverage: {Math.round(estimate.coverageFraction * 100)}%. Lower coverage means more uncertainty.
          </p>
        </section>
      ) : (
        <p className="rounded border border-amber-300 bg-amber-50 p-4 text-sm">
          The latest local estimate is currently unavailable. We will not substitute stale data as if it were live.
        </p>
      )}
    </main>
  );
}
