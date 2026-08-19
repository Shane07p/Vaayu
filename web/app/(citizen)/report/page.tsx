/**
 * Citizen photo report.
 *
 * TODO(member-4): upload form posting to /api/v1/reports.
 *
 * The result is a coarse band — good, moderate, poor, severe — never a
 * concentration. Published work on estimating PM2.5 from a photograph tops out
 * around R-squared 0.6 and degrades badly with camera and lighting variation.
 * Display the confidence weight alongside the band.
 *
 * Collect no personal data beyond coarse geolocation.
 */

export default function ReportPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-2 p-6">
      <h1 className="text-2xl font-semibold">Report what you see</h1>
      <p className="text-sm text-muted-foreground">
        Photos give a rough band, never an exact reading. Satellites miss
        evening burning; your report helps cover that gap.
      </p>
    </main>
  );
}
