import { fetchWorklist } from "@/lib/api";
import type { WorklistItem } from "@/lib/schemas";

export default async function WorklistPage() {
  let items: WorklistItem[] = [];
  try {
    items = await fetchWorklist();
  } catch {
    // An empty worklist is safer than showing a stale enforcement recommendation.
  }

  return (
    <main className="mx-auto max-w-7xl space-y-5 p-6">
      <h1 className="text-2xl font-semibold">Enforcement worklist</h1>
      <p className="text-sm text-slate-600">
        Fire clusters ranked by predicted downwind population exposure.
      </p>
      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-slate-600">
            <tr>
              <th className="p-3">Rank</th><th className="p-3">Cluster</th><th className="p-3">Location</th><th className="p-3">Downwind population</th><th className="p-3">Transport</th><th className="p-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.clusterCode} className="border-b last:border-0">
                <td className="p-3 font-semibold">{item.impactRank}</td>
                <td className="p-3">{item.clusterCode}</td>
                <td className="p-3">{item.tehsil}, {item.state}</td>
                <td className="p-3">{item.downwindPopulation?.toLocaleString() ?? "Unknown"}</td>
                <td className="p-3">{item.transportHours ?? "Unknown"} h</td>
                <td className="p-3">
                  {item.direction95Eligible ? <span className="font-medium text-red-700">Direction 95 escalation eligible</span> : "Prioritise field verification"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!items.length && <p className="rounded border border-amber-300 bg-amber-50 p-4 text-sm">No current enforcement priorities are available.</p>}
    </main>
  );
}
