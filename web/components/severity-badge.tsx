"use client";

interface SeverityBadgeProps {
  band?: string | null;
  grapStage?: "I" | "II" | "III" | "IV" | string | null;
  direction95?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function SeverityBadge({
  band,
  grapStage,
  direction95,
  size = "md",
  className = "",
}: SeverityBadgeProps) {
  // Size classes
  const sizeClasses = {
    sm: "px-2 py-0.5 text-[10px] tracking-wider",
    md: "px-2.5 py-1 text-xs tracking-wider",
    lg: "px-3.5 py-1.5 text-sm tracking-widest font-semibold",
  }[size];

  if (direction95) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 font-mono font-bold uppercase rounded border bg-red-950/80 text-red-200 border-red-500 shadow-[0_0_12px_rgba(239,68,68,0.3)] ${sizeClasses} ${className}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping" />
        DIRECTION-95 ELIGIBLE
      </span>
    );
  }

  if (grapStage) {
    const stage = grapStage.toUpperCase();
    let style = "bg-slate-800 text-slate-300 border-slate-700";

    if (stage === "I") {
      style = "bg-emerald-950/60 text-emerald-300 border-emerald-700/80";
    } else if (stage === "II") {
      style = "bg-amber-950/60 text-amber-300 border-amber-600/80";
    } else if (stage === "III") {
      style = "bg-orange-950/70 text-orange-200 border-orange-600/90 shadow-[0_0_10px_rgba(249,115,22,0.2)]";
    } else if (stage === "IV") {
      style = "bg-red-950/90 text-red-100 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]";
    }

    return (
      <span
        className={`inline-flex items-center gap-1 font-mono font-semibold uppercase rounded border ${style} ${sizeClasses} ${className}`}
      >
        GRAP STAGE {grapStage}
      </span>
    );
  }

  if (band) {
    const normalized = band.toUpperCase();
    let style = "bg-slate-800 text-slate-300 border-slate-700";

    if (normalized.includes("GOOD") || normalized.includes("SATISFACTORY")) {
      style = "bg-emerald-950/60 text-emerald-300 border-emerald-800";
    } else if (normalized.includes("MODERATE")) {
      style = "bg-yellow-950/60 text-yellow-300 border-yellow-800";
    } else if (normalized.includes("POOR") && !normalized.includes("VERY")) {
      style = "bg-orange-950/70 text-orange-300 border-orange-800";
    } else if (normalized.includes("VERY POOR")) {
      style = "bg-red-950/80 text-red-200 border-red-800";
    } else if (normalized.includes("SEVERE") || normalized.includes("CRITICAL")) {
      style = "bg-purple-950/90 text-purple-200 border-purple-800 shadow-[0_0_12px_rgba(168,85,247,0.3)]";
    }

    return (
      <span
        className={`inline-flex items-center gap-1 font-mono font-medium uppercase rounded border ${style} ${sizeClasses} ${className}`}
      >
        {band}
      </span>
    );
  }

  return null;
}
