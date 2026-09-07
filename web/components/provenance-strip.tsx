import { fetchProvenance } from "@/lib/api";
import type { FeedProvenance, Provenance } from "@/lib/schemas";

/**
 * What the data on screen actually is.
 *
 * This replaces StatusStrip, which printed "Stations: CPCB Active",
 * "Fires: FIRMS VIIRS/MODIS" and "Meteo: ERA5 / IMD GFS" with green indicators
 * on every console screen, unconditionally, from string literals. None of those
 * feeds had run. Every row in the database was seed data and the meteorology
 * table was empty.
 *
 * Every row below is derived from ingestion_run. There is nothing to type here,
 * so there is nothing to overstate, and the banner disappears on its own the day
 * a feed goes live.
 */

const STATE_STYLE: Record<FeedProvenance["state"], { dot: string; text: string; label: string }> = {
  LIVE: { dot: "bg-emerald-400", text: "text-emerald-300", label: "live" },
  // Amber rather than green: some units are missing from this run, and a green
  // dot would describe an incomplete result as a complete one.
  PARTIAL: { dot: "bg-amber-400", text: "text-amber-300", label: "live, partial" },
  FIXTURE: { dot: "bg-amber-400", text: "text-amber-300", label: "seed data" },
  // Hollow, not coloured: a feed nobody has ever run is not a working feed
  // showing an unusual value. It is an absence.
  NEVER_RUN: { dot: "bg-transparent border border-slate-600", text: "text-slate-500", label: "not connected" },
  UNAVAILABLE: { dot: "bg-orange-400", text: "text-orange-300", label: "upstream down" },
  FAILED: { dot: "bg-red-500", text: "text-red-300", label: "failed" },
  RUNNING: { dot: "bg-sky-400", text: "text-sky-300", label: "running" },
};

/** Age in words. Exact enough to judge freshness, not falsely precise. */
function age(iso: string | null): string | null {
  if (!iso) return null;
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (!Number.isFinite(minutes) || minutes < 0) return null;
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function FeedRow({ feed }: { feed: FeedProvenance }) {
  const style = STATE_STYLE[feed.state];
  const when = age(feed.lastRunAt);

  return (
    <div className="flex items-center gap-1.5" title={feed.error ?? undefined}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${style.dot}`} />
      <span className="text-slate-400">{feed.liveName}:</span>
      <span className={style.text}>{style.label}</span>
      {feed.state === "PARTIAL" && feed.rowCount !== null && (
        <span className="text-slate-500">{feed.rowCount} rows</span>
      )}
      {when && <span className="text-slate-600">{when}</span>}
    </div>
  );
}

export async function ProvenanceStrip({ className = "" }: { className?: string }) {
  let provenance: Provenance | null = null;
  try {
    provenance = await fetchProvenance();
  } catch {
    // Saying nothing is better than asserting a state we could not read.
  }

  if (!provenance) {
    return (
      <div
        className={`px-4 py-2.5 rounded-2xl bg-white/[0.03] border border-white/10 text-xs font-mono text-slate-500 ${className}`}
      >
        Provenance unavailable — this console cannot currently confirm where its data came from.
      </div>
    );
  }

  const { feeds, model } = provenance;
  const anyLive = feeds.some((feed) => feed.state === "LIVE");

  return (
    <div
      className={`rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md text-xs font-mono text-slate-300 ${className}`}
    >
      {!anyLive && (
        <div className="px-4 pt-2.5 pb-2 text-[11px] text-amber-300 border-b border-white/[0.06]">
          <span className="font-semibold">Demonstration data</span> — no live feed is
          connected. VAAYU will not render fabricated observations as live.
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <span className="text-slate-500 uppercase tracking-wider text-[10px] font-bold">
            Where this comes from
          </span>
          {feeds.map((feed) => (
            <FeedRow key={feed.source} feed={feed} />
          ))}
        </div>

        <div className="flex items-center gap-4 text-slate-400">
          <div>
            <span className="text-slate-500">Model: </span>
            <span className="text-slate-200 font-semibold">{model.version ?? "none"}</span>
            {/* Stated plainly. A seeded database describing itself as a trained
                model is the same overstatement as a seed row badged live. */}
            {!model.isTrainedModel && (
              <span className="ml-1.5 text-amber-400">not a trained model</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
