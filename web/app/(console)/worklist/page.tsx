import { fetchWorklist } from "@/lib/api";
import { ProvenanceStrip } from "@/components/provenance-strip";
import type { WorklistItem } from "@/lib/schemas";

export default async function WorklistPage() {
  let items: WorklistItem[] = [];
  try {
    items = await fetchWorklist();
  } catch {
    // An empty worklist is safer than showing a stale enforcement recommendation.
  }

  const activeCount = items.length;
  const highImpact = items.filter((i) => i.impactRank <= 3).length;
  const d95Count = items.filter((i) => i.direction95Eligible).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-100 mb-1">
          Farm fires
        </h1>
        <p className="text-sm text-slate-400">
          Ranked by expected downwind population impact. Direction-95 eligible clusters
          require statutory escalation.
        </p>
      </div>

      <ProvenanceStrip />

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-1">
            Active Clusters
          </div>
          <div className="text-3xl font-bold font-mono text-slate-100">{activeCount}</div>
        </div>
        <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-800/50">
          <div className="text-[10px] font-mono uppercase tracking-wider text-amber-400 mb-1">
            High Impact
          </div>
          <div className="text-3xl font-bold font-mono text-amber-300">{highImpact}</div>
          <div className="text-[10px] text-slate-500 font-mono">Rank #1–3</div>
        </div>
        <div className="p-4 rounded-xl bg-red-950/30 border border-red-800/50">
          <div className="text-[10px] font-mono uppercase tracking-wider text-red-400 mb-1">
            Direction-95
          </div>
          <div className="text-3xl font-bold font-mono text-red-300">{d95Count}</div>
          <div className="text-[10px] text-slate-500 font-mono">Eligible</div>
        </div>
      </div>

      {/* Main Table */}
      {items.length > 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm font-mono">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/80 text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="p-3 w-16">Rank</th>
                  <th className="p-3">Cluster</th>
                  <th className="p-3">Region</th>
                  <th className="p-3 text-right">FRP (MW)</th>
                  <th className="p-3 text-right">Downwind Pop.</th>
                  <th className="p-3 text-right">Transport</th>
                  <th className="p-3 text-right">Confidence</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-center">Unactioned</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const isTopRank = item.impactRank === 1;
                  const isD95 = item.direction95Eligible;
                  const daysColor =
                    item.consecutiveDaysUnactioned >= 5
                      ? "text-red-400"
                      : item.consecutiveDaysUnactioned >= 3
                        ? "text-amber-400"
                        : "text-slate-400";

                  return (
                    <tr
                      key={item.clusterCode}
                      className={`border-b border-slate-800/60 transition-colors hover:bg-slate-900/60 ${
                        isTopRank
                          ? "bg-amber-950/15 border-l-2 border-l-amber-500"
                          : isD95
                            ? "bg-red-950/10"
                            : ""
                      }`}
                    >
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-bold ${
                            isTopRank
                              ? "bg-amber-500/20 text-amber-300 text-base"
                              : "bg-slate-900 text-slate-300 text-sm"
                          }`}
                        >
                          #{item.impactRank}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-slate-200">{item.clusterCode}</div>
                      </td>
                      <td className="p-3 text-slate-300 text-xs">
                        {[item.tehsil, item.district, item.state]
                          .filter(Boolean)
                          .join(", ")}
                      </td>
                      <td className="p-3 text-right text-slate-200 font-semibold">
                        {item.totalFrp.toFixed(0)}
                      </td>
                      <td className="p-3 text-right text-slate-200">
                        {item.downwindPopulation
                          ? (item.downwindPopulation / 1_000_000).toFixed(1) + "M"
                          : "—"}
                      </td>
                      <td className="p-3 text-right text-slate-300">
                        {item.transportHours
                          ? item.transportHours.toFixed(1) + "h"
                          : "—"}
                      </td>
                      <td className="p-3 text-right text-slate-300">
                        {item.trajectoryConfidence
                          ? Math.round(item.trajectoryConfidence * 100) + "%"
                          : "—"}
                      </td>
                      <td className="p-3 text-center">
                        {isD95 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-red-950/70 text-red-300 border border-red-600 shadow-[0_0_8px_rgba(239,68,68,0.2)]">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                            D-95
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500">Monitor</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`font-semibold ${daysColor}`}>
                          {item.consecutiveDaysUnactioned}d
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-8 text-center space-y-2">
          <div className="text-sm font-mono text-slate-400 uppercase tracking-wider">
            No Active Fire Clusters
          </div>
          <p className="text-xs text-slate-500">
            No fire clusters currently meet the impact threshold for the Delhi-NCR receptor.
          </p>
        </div>
      )}
    </div>
  );
}
