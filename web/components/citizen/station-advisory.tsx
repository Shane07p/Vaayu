"use client";

import { fetchAdvisory } from "@/lib/api";
import { useCitizenI18n } from "@/lib/i18n";
import { NarrativePanel } from "@/components/narrative-panel";

/**
 * A plain-language advisory for the place a reader has selected.
 *
 * <p>The language follows the one chosen in the header, because a reader who
 * has already said which language they read should not have to say it twice.
 * The panel still offers the full set, since the API supports more languages
 * than the interface is translated into.
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

export function StationAdvisory({ lat, lon }: { lat: number; lon: number }) {
  const { language } = useCitizenI18n();

  return (
    <NarrativePanel
      generate={(chosen) => fetchAdvisory(lat, lon, chosen)}
      languages={LANGUAGES}
      initialLanguage={language}
      actionLabel="Explain this"
      className="mt-3"
    />
  );
}
