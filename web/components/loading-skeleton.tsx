"use client";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded bg-slate-800/60 border border-slate-700/40 ${className}`}
    />
  );
}

export function MapSkeleton() {
  return (
    <div className="relative w-full h-[620px] rounded-xl overflow-hidden border border-slate-800 bg-slate-950 flex flex-col items-center justify-center">
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-40" />
      <div className="relative z-10 flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-teal-500/30 border-t-teal-400 animate-spin" />
        <div className="text-xs font-mono uppercase tracking-wider text-slate-400">
          Loading Geospatial Surface & Telemetry…
        </div>
      </div>
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="w-full h-80 rounded-xl border border-slate-800 bg-slate-950/60 p-6 flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-28" />
      </div>
      <div className="space-y-4 my-auto">
        <Skeleton className="h-32 w-full" />
      </div>
      <div className="flex justify-between">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-16" />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="w-full rounded-xl border border-slate-800 bg-slate-950/60 overflow-hidden">
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-8 w-60" />
      </div>
      <div className="p-4 space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-6 w-12" />
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-6 flex-1" />
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function MetricCardSkeleton() {
  return (
    <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 space-y-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-36" />
      <Skeleton className="h-3 w-48" />
    </div>
  );
}
