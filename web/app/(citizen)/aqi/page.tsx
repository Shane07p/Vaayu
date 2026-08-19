/**
 * Local air quality for a citizen.
 *
 * TODO(member-4): resolve the visitor's coarse location to a grid cell and show
 * the estimate with its uncertainty.
 *
 * Two non-negotiables: badge fixture-backed values as CACHED, and state plainly
 * when there is no monitoring station nearby so the number is a model estimate.
 */

export default function AqiPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-2 p-6">
      <h1 className="text-2xl font-semibold">Air quality near you</h1>
      <p className="text-sm text-muted-foreground">
        Where there is no monitoring station nearby, this is a model estimate
        with stated uncertainty, not a measurement.
      </p>
    </main>
  );
}
