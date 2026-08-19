/**
 * 6 / 24 / 72 hour forecast against its baselines.
 *
 * TODO(member-4): Recharts line chart plotting the model against
 * `baselinePersistence` and `baselineCams`.
 *
 * The baseline lines are not optional. A forecast chart without the baseline it
 * must beat is the failure mode docs/TECHNICAL.md section 6.2 warns against.
 */

export default function ForecastPage() {
  return (
    <main className="mx-auto max-w-7xl space-y-2 p-6">
      <h1 className="text-2xl font-semibold">Forecast</h1>
      <p className="text-sm text-muted-foreground">
        Shown against persistence and CAMS baselines.
      </p>
    </main>
  );
}
