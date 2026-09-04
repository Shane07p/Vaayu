"use client";

import { useState } from "react";
import { BANDS, BAND_COLOR, BAND_RANGE, bandFor } from "@/lib/aqi-band";
import { adviceFor, bandName, type Audience } from "@/lib/guidance";
import { useCitizenI18n } from "@/lib/i18n";

/**
 * An AQI reading, the band it sits in, and what to do about it.
 *
 * The one rule this component exists to enforce: a number never appears alone.
 * Half of the people who take no action about air pollution say the reason is
 * that they do not know what action to take (docs/EVIDENCE.md §1.1), and
 * severity shown without an achievable instruction produces avoidance rather
 * than protection (§1.2). So the advice is not an optional extra rendered
 * beside the figure -- it is part of the figure, and there is no prop to turn
 * it off.
 *
 * The raw concentration is shown next to the index rather than behind it, which
 * is WHO's 2026 recommendation (§1.5). Awareness of PM2.5 as a term is lower in
 * India than awareness of AQI, so it is labelled with its unit and left small:
 * present for anyone who wants it, not competing with the number that carries
 * the meaning.
 *
 * "What does this mean" expands the scale in place rather than navigating. A
 * reader who leaves the page to learn something does not come back to act on
 * it, and a separate explainer page is one almost nobody opens.
 */

type Props = {
  aqi: number;
  pm25?: number | null;
  audience?: Audience;
  /** Compact drops the scale expander, for list rows. */
  size?: "large" | "compact";
  className?: string;
};

export function AirFigure({
  aqi,
  pm25,
  audience = "everyone",
  size = "large",
  className = "",
}: Props) {
  const { language } = useCitizenI18n();
  const [showScale, setShowScale] = useState(false);

  const band = bandFor(aqi);
  const colour = BAND_COLOR[band];
  const advice = adviceFor(band, language, audience);

  if (size === "compact") {
    return (
      <div className={`space-y-1 ${className}`}>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold tabular-nums" style={{ color: colour }}>
            {aqi}
          </span>
          <span className="text-sm font-medium" style={{ color: colour }}>
            {bandName(band, language)}
          </span>
        </div>
        <p className="text-[12px] leading-snug text-slate-300">{advice}</p>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-baseline gap-3 flex-wrap">
        <span className="text-5xl font-bold tabular-nums leading-none" style={{ color: colour }}>
          {aqi}
        </span>
        <span className="text-lg font-semibold" style={{ color: colour }}>
          {bandName(band, language)}
        </span>
        {typeof pm25 === "number" && (
          /* Alongside the index, never instead of it. */
          <span className="text-[11px] font-mono text-slate-400">
            PM2.5 {pm25} µg/m³
          </span>
        )}
      </div>

      {/* The instruction. The reason this component exists. */}
      <p className="text-sm leading-relaxed text-slate-100">{advice}</p>

      <div>
        <button
          type="button"
          onClick={() => setShowScale((open) => !open)}
          aria-expanded={showScale}
          className="text-[11px] font-mono text-slate-400 hover:text-slate-200 transition-colors"
        >
          {showScale ? "▾" : "▸"} What does {aqi} mean?
        </button>

        {showScale && (
          <div className="mt-2 space-y-1.5">
            {/* The whole scale, with the reader's own figure marked on it, so
                the number is placed rather than merely named. */}
            {BANDS.map((entry) => {
              const [low, high] = BAND_RANGE[entry];
              const isCurrent = entry === band;
              return (
                <div
                  key={entry}
                  className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 ${
                    isCurrent ? "bg-white/[0.07]" : ""
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: BAND_COLOR[entry] }}
                  />
                  <span
                    className={`text-[11px] font-mono tabular-nums w-16 shrink-0 ${
                      isCurrent ? "text-slate-200" : "text-slate-500"
                    }`}
                  >
                    {low}–{high}
                  </span>
                  <span
                    className={`text-[12px] ${
                      isCurrent ? "font-semibold text-slate-100" : "text-slate-400"
                    }`}
                  >
                    {bandName(entry, language)}
                  </span>
                  {isCurrent && (
                    <span className="text-[10px] font-mono text-slate-400 ml-auto">
                      ← {aqi}
                    </span>
                  )}
                </div>
              );
            })}
            <p className="pt-1 text-[10px] font-mono leading-relaxed text-slate-500">
              India&apos;s CPCB scale. Higher is worse.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
