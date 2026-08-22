"use client";

interface SourceBadgeProps {
  source: string;
  className?: string;
  showDot?: boolean;
}

export function SourceBadge({ source, className = "", showDot = true }: SourceBadgeProps) {
  const normalized = source.toUpperCase();
  const isCached = normalized === "SEED" || normalized === "FIXTURE" || normalized === "CACHED";
  const isUnavailable = normalized === "SOURCE_UNAVAILABLE" || normalized === "UNAVAILABLE";
  const isLive = normalized === "LIVE" || normalized === "CPCB" || normalized === "OPENAQ" || normalized === "FIRMS" || normalized === "GEE" || normalized === "CAMS";

  let badgeColor = "bg-slate-800/80 text-slate-300 border-slate-700";
  let dotColor = "bg-slate-400";
  let displayText = source;

  if (isCached) {
    badgeColor = "bg-amber-950/50 text-amber-300 border-amber-800/60";
    dotColor = "bg-amber-400";
    displayText = "CACHED";
  } else if (isUnavailable) {
    badgeColor = "bg-red-950/60 text-red-300 border-red-800/60";
    dotColor = "bg-red-500 animate-pulse";
    displayText = "SOURCE UNAVAILABLE";
  } else if (isLive) {
    badgeColor = "bg-emerald-950/50 text-emerald-300 border-emerald-800/60";
    dotColor = "bg-emerald-400";
    displayText = normalized === "LIVE" ? "LIVE" : source;
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium tracking-wide uppercase border ${badgeColor} ${className}`}
      title={isCached ? "Sample/fixture data. VAAYU does not disguise cached data as live telemetry." : undefined}
    >
      {showDot && <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />}
      {displayText}
    </span>
  );
}
