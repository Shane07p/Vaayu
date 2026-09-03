"use client";

import { fetchAlertNarrative } from "@/lib/api";
import { NarrativePanel } from "@/components/narrative-panel";

/**
 * The officer briefing for one alert.
 *
 * <p>An alert packet names a statute, a jurisdiction and a set of actions. An
 * officer acts on prose. Turning one into the other is a language task, which
 * is what this is for -- and every figure it uses is checked against the packet
 * it came from before it is shown.
 */

/**
 * The console offers the eight the API supports. Officials read English, but a
 * briefing that has to be relayed locally is more useful in the language it
 * will be relayed in.
 */
const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
  { code: "pa", label: "ਪੰਜਾਬੀ" },
  { code: "ur", label: "اردو" },
  { code: "bn", label: "বাংলা" },
  { code: "mr", label: "मराठी" },
  { code: "ta", label: "தமிழ்" },
  { code: "te", label: "తెలుగు" },
];

export function AlertBriefing({ alertId }: { alertId: string }) {
  return (
    <NarrativePanel
      generate={(language) => fetchAlertNarrative(alertId, language)}
      languages={LANGUAGES}
      actionLabel="Write briefing"
      className="mt-4"
    />
  );
}
