"use client";
import { useCitizenI18n, type Language } from "@/lib/i18n";
const labels: Record<Language, string> = { en: "EN", hi: "हिंदी", pa: "ਪੰਜਾਬੀ" };
export function LanguageSelector() { const { language, setLanguage } = useCitizenI18n(); return <div className="flex rounded-lg border border-white/10 bg-white/[0.04] p-0.5 text-[10px] font-mono">{(Object.keys(labels) as Language[]).map((item) => <button key={item} onClick={() => setLanguage(item)} className={`rounded-md px-2 py-1 transition-colors ${language === item ? "bg-teal-500/20 text-teal-200" : "text-slate-400 hover:text-slate-200"}`}>{labels[item]}</button>)}</div>; }
