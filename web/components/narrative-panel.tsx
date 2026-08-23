"use client";

import { useState } from "react";
import type { NarrativeResult } from "@/lib/schemas";

/**
 * A generated narrative, and what to say when there isn't one.
 *
 * <p>Generation is on demand rather than automatic. It takes about twenty
 * seconds, and the model's free tier allows twenty requests a day, so firing on
 * every page load would spend the quota on readers who never asked and block
 * the page while doing it.
 *
 * <p>Three outcomes, kept distinct on screen because they are distinct:
 * the prose; the model being unreachable; and the model answering with a number
 * nobody gave it. The last is the interesting one, and it is shown as a
 * deliberate refusal rather than an error, because that is what it is.
 */

type Props = {
  /** Runs the generation. Rejects if the request itself fails. */
  generate: (language: string) => Promise<NarrativeResult>;
  /** Languages offered here. The API supports eight. */
  languages: { code: string; label: string }[];
  initialLanguage?: string;
  /** Button copy, so the officer and citizen surfaces can differ. */
  actionLabel: string;
  className?: string;
};

export function NarrativePanel({
  generate,
  languages,
  initialLanguage = "en",
  actionLabel,
  className = "",
}: Props) {
  const [language, setLanguage] = useState(initialLanguage);
  const [result, setResult] = useState<NarrativeResult | null>(null);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function run(next: string) {
    setPending(true);
    setFailed(false);
    try {
      setResult(await generate(next));
    } catch {
      // The request never completed. Distinct from the model answering badly,
      // and the panel says so rather than showing an empty narrative.
      setResult(null);
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className={`rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3 ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
          Generated summary
          {/* Named, because a reader is entitled to know a machine wrote it. */}
          <span className="ml-1.5 text-slate-600">· Gemini</span>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={language}
            onChange={(event) => {
              setLanguage(event.target.value);
              if (result || failed) void run(event.target.value);
            }}
            className="rounded-lg border border-white/10 bg-[#0b1220] px-2 py-1 text-[11px] font-mono text-slate-200"
            aria-label="Language"
          >
            {languages.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => void run(language)}
            disabled={pending}
            className="rounded-lg border border-teal-800/60 bg-teal-950/40 px-3 py-1 text-[11px] font-mono text-teal-300 hover:bg-teal-900/40 disabled:opacity-50 transition-colors"
          >
            {pending ? "Generating…" : result ? "Regenerate" : actionLabel}
          </button>
        </div>
      </div>

      {pending && (
        <p className="text-[11px] font-mono text-slate-500">
          Writing from the facts below. This takes a few seconds.
        </p>
      )}

      {failed && !pending && (
        <p className="rounded-lg border border-amber-800/60 bg-amber-950/30 px-3 py-2 text-[11px] font-mono text-amber-300">
          The request did not complete. Nothing was generated.
        </p>
      )}

      {result?.status === "OK" && result.narrative && (
        <p className="text-sm leading-relaxed text-slate-200">{result.narrative}</p>
      )}

      {result?.status === "SOURCE_UNAVAILABLE" && (
        <p className="rounded-lg border border-amber-800/60 bg-amber-950/30 px-3 py-2 text-[11px] font-mono text-amber-300">
          The model could not be reached, so no summary was written. The figures
          below are unaffected.
        </p>
      )}

      {result?.status === "UNGROUNDED" && (
        <div className="rounded-lg border border-red-900/60 bg-red-950/30 px-3 py-2 space-y-1">
          <p className="text-[11px] font-mono text-red-300">
            Summary withheld: it stated{" "}
            {result.unsourcedNumbers.length === 1 ? "a figure" : "figures"} that
            no source supports
            {result.unsourcedNumbers.length > 0 && (
              <> — {result.unsourcedNumbers.join(", ")}</>
            )}
            .
          </p>
          {/* The point of the check, said plainly. A withheld summary is the
              feature working, not a fault to apologise for. */}
          <p className="text-[10px] font-mono text-slate-500">
            Every figure in a summary must appear in the facts it was given. This
            one did not, so it is not shown.
          </p>
        </div>
      )}

      {result && result.status !== "OK" && (
        <dl className="grid grid-cols-1 gap-1 text-[11px] font-mono sm:grid-cols-2">
          {Object.entries(result.facts).map(([label, value]) => (
            <div key={label} className="rounded-lg bg-white/[0.04] px-2.5 py-1.5">
              <dt className="text-[9px] uppercase tracking-wider text-slate-500">{label}</dt>
              <dd className="text-slate-200">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
