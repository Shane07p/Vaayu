"use client";

import { useCitizenI18n, type Language } from "@/lib/i18n";

const labels: Record<Language, string> = {
  en: "EN",
  hi: "हिंदी",
  pa: "ਪੰਜਾਬੀ",
};

export function LanguageSelector({ className = "" }: { className?: string }) {
  const { language, setLanguage } = useCitizenI18n();

  return (
    <div
      className={`inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] p-0.5 shadow-inner backdrop-blur-md transition-all ${className}`}
      role="group"
      aria-label="Select language"
    >
      {(Object.keys(labels) as Language[]).map((item) => {
        const isActive = language === item;
        return (
          <button
            key={item}
            type="button"
            onClick={() => setLanguage(item)}
            className={`relative rounded-full px-2.5 py-1 text-xs font-medium transition-all duration-200 ${
              isActive
                ? "bg-teal-500/25 text-teal-200 shadow-sm border border-teal-400/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.06]"
            }`}
          >
            {labels[item]}
          </button>
        );
      })}
    </div>
  );
}
