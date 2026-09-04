"use client";

import Link from "next/link";
import { bandFor, colorFor } from "@/lib/aqi-band";
import { bandName } from "@/lib/guidance";
import { useCitizenI18n } from "@/lib/i18n";
import type { CityRankings } from "@/lib/schemas";

/**
 * Presentation for the city ranking.
 *
 * Split from the page so the fetch stays on the server while the copy reads
 * from the language context. Before this the selector translated the navigation
 * and left every reading in English, which promises a translation the page does
 * not deliver.
 */

/*
 * A local bandColor lived here with the correct CPCB thresholds but its own
 * palette, so the same reading was one colour on the map and another in this
 * list. lib/aqi-band.ts is now the only scale and the only palette.
 */

/** Age in words. The exact measurement time is on the station card. */
/**
 * How long ago a reading was measured.
 *
 * Days once past a day, rather than "47 h". The ranking window is two days
 * because OpenAQ mirrors the government network in batches that far behind, so
 * these ages are routinely in the tens of hours and a reader has to be able to
 * see at a glance that a figure is from yesterday.
 */
function ago(iso: string, justNow: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return justNow;
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "1 day" : `${days} days`;
}

export function RankingsView({ rankings }: { rankings: CityRankings | null }) {
  const { t, language } = useCitizenI18n();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-100 mb-1">
          {t.rankingsTitle}
        </h1>
        <p className="text-sm text-slate-400">{t.rankingsIntro}</p>
      </div>

      {!rankings ? (
        <div className="rounded-2xl border border-amber-800/60 bg-amber-950/30 p-5 text-sm text-slate-300">
          {t.rankingsUnavailable}
        </div>
      ) : rankings.cities.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-slate-400">
          {t.rankingsEmpty}
        </div>
      ) : (
        <>
          <ol className="space-y-2">
            {rankings.cities.map((city, index) => (
              <li key={city.city}>
                {/* Opens the map at the station the figure came from, not at a
                    notional city centre: the reading belongs to that point. */}
                <Link
                  href={`/aqi?lat=${city.lat}&lon=${city.lon}&name=${encodeURIComponent(city.city)}`}
                  className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 hover:bg-white/[0.06] hover:border-white/20 transition-colors"
                >
                  <span className="w-6 text-right font-mono text-xs text-slate-500">
                    {index + 1}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-sm font-semibold text-slate-100 truncate">
                      {city.city}
                    </div>
                    {/* Named, so the city is not characterised by a number whose
                        origin the reader cannot see. */}
                    <div className="text-[11px] text-slate-500 truncate">
                      {city.worstStation}
                    </div>
                    <div className="text-[10px] font-mono text-slate-600 mt-0.5">
                      {city.stationCount === 1
                        ? t.oneStation
                        : `${t.worstOf} ${city.stationCount} ${t.stationsWord}`}
                      {" · "}
                      {ago(city.measuredAt, t.loading)}
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <div
                      className="font-mono text-2xl font-black leading-none"
                      style={{ color: colorFor(city.aqi) }}
                    >
                      {city.aqi}
                    </div>
                    {/* The band, not only the index. Roughly a third of Indians
                        who have heard of AQI say they understand what it means
                        (EVIDENCE §1.1), so a bare 401 does not communicate --
                        "Severe" does, and it is the word a government bulletin
                        would use. */}
                    <div
                      className="text-[11px] font-semibold leading-tight mt-0.5"
                      style={{ color: colorFor(city.aqi) }}
                    >
                      {bandName(bandFor(city.aqi), language)}
                    </div>
                    <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                      {city.pm25} µg/m³
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ol>

          {/*
            The excluded counts are the difference between a ranking and a claim
            about the country. A "worst air today" list that silently omits the
            cities it could not measure implies they were checked and found
            cleaner.
          */}
          <p className="text-[11px] font-mono text-slate-500 border-t border-white/10 pt-3">
            {t.rankedFrom}
            {rankings.excluded > 0 && (
              <>
                {" "}
                {rankings.excluded} {t.excludedCities}
              </>
            )}
            {rankings.unattributedStations > 0 && (
              <>
                {" "}
                {rankings.unattributedStations} {t.unattributedStations}
              </>
            )}
          </p>
        </>
      )}
    </div>
  );
}
