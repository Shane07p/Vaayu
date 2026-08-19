/**
 * Issued alert packets.
 *
 * TODO(member-4): list from fetchAlerts(). Every alert must display its
 * statutory basis, mandated actions, confidence interval, model version, and
 * evidence sources — an authority acting on it has to be able to audit it.
 */

export default function AlertsPage() {
  return (
    <main className="mx-auto max-w-7xl space-y-2 p-6">
      <h1 className="text-2xl font-semibold">Alerts</h1>
      <p className="text-sm text-muted-foreground">
        Each alert names a statute, a jurisdiction, and a required action.
      </p>
    </main>
  );
}
