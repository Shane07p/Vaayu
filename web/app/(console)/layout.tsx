import { Sidebar } from "@/components/sidebar";
import { fetchProvenance } from "@/lib/api";
import type { Provenance } from "@/lib/schemas";
import { Topbar } from "@/components/topbar";
import { AtmosphericBackground } from "@/components/citizen/atmospheric-background";

/**
 * The console footer names the model behind every figure on screen, so the
 * layout reads it rather than the sidebar asserting one. A failure here is not
 * fatal to the console: the sidebar reports the model as unknown and the pages
 * still render.
 */
/**
 * How long ago the newest working feed last ran.
 *
 * Only LIVE and PARTIAL runs count. A feed that has never run, failed, or fell
 * back to fixtures has not delivered anything, and letting it set the console's
 * "last updated" would report freshness the data does not have.
 *
 * Null when no feed qualifies, which the topbar renders as no line at all.
 */
function mostRecentFeedRun(feeds: Provenance["feeds"]): string | null {
  const times = feeds
    .filter((feed) => feed.state === "LIVE" || feed.state === "PARTIAL")
    .map((feed) => feed.lastRunAt)
    .filter((at): at is string => Boolean(at))
    .map((at) => new Date(at).getTime())
    .filter((at) => Number.isFinite(at));

  if (!times.length) return null;

  const minutes = Math.floor((Date.now() - Math.max(...times)) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

export default async function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let model: Provenance["model"] | null = null;
  let lastUpdated: string | null = null;
  try {
    const provenance = await fetchProvenance();
    model = provenance.model;
    lastUpdated = mostRecentFeedRun(provenance.feeds);
  } catch {
    // Reported as "none trained" rather than as a name nobody verified, and the
    // topbar simply omits its freshness line rather than inventing one.
  }

  return (
    <div className="relative flex min-h-screen bg-[#070a0e] text-slate-100 antialiased font-sans">
      {/* Underlying Atmospheric Blurred Background Layer */}
      <AtmosphericBackground
        imageSrc="/backgrounds/normal.png"
        overlayOpacity={0.92}
        blur={28}
        className="fixed inset-0"
      />

      {/* Fixed Desktop Sidebar */}
      <Sidebar model={model} />

      {/* Main Console Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-transparent relative z-10">
        <Topbar lastUpdated={lastUpdated} />
        <div className="flex-1 p-6 md:p-8 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
