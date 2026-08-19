/**
 * District enforcement worklist.
 *
 * The page that most directly expresses the project's core principle: it must
 * render the statute and the action, not just the numbers.
 *
 * TODO(member-4): table from fetchWorklist(), ordered by impactRank, with the
 * Direction 95 escalation badge where `direction95Eligible` is true.
 */

export default function WorklistPage() {
  return (
    <main className="mx-auto max-w-7xl space-y-2 p-6">
      <h1 className="text-2xl font-semibold">Enforcement worklist</h1>
      <p className="text-sm text-muted-foreground">
        Fire clusters ranked by predicted downwind population exposure.
      </p>
    </main>
  );
}
