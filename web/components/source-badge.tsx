export function SourceBadge({ source }: { source: string }) {
  const cached = source === "SEED" || source === "FIXTURE";
  return (
    <span
      className={`rounded-full px-2 py-1 text-xs font-medium ${
        cached ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-900"
      }`}
    >
      {cached ? "CACHED" : source}
    </span>
  );
}
