"use client";

import Link from "next/link";
import { LanguageSelector } from "@/components/citizen/language-selector";
import { CitizenI18nProvider, useCitizenI18n } from "@/lib/i18n";

function CitizenChrome({ children }: { children: React.ReactNode }) {
  const { t } = useCitizenI18n();
  return <div className="min-h-screen bg-[#080b0d] text-slate-100 font-sans antialiased">
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#080b0d]/80 backdrop-blur-xl"><div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-3.5 sm:px-5">
      <Link href="/" className="flex items-center gap-2.5"><span className="flex h-8 w-8 items-center justify-center rounded-xl border border-teal-500/30 bg-teal-500/10 font-mono text-teal-400">~</span><span><span className="block font-mono text-sm font-bold tracking-wider">VAAYU</span><span className="block text-[8px] font-mono tracking-widest text-slate-400">AIR QUALITY INTELLIGENCE</span></span></Link>
      <nav className="flex items-center gap-1 sm:gap-2"><LanguageSelector /><Link href="/aqi" className="rounded-xl px-2 py-1.5 text-xs font-mono text-slate-200 sm:px-3">{t.myAir}</Link><Link href="/rankings" className="rounded-xl px-2 py-1.5 text-xs font-mono text-slate-400 sm:px-3">{t.rankings}</Link><Link href="/report" className="rounded-xl px-2 py-1.5 text-xs font-mono text-slate-400 sm:px-3">{t.report}</Link><Link href="/map" className="hidden rounded-xl px-3 py-1.5 text-xs font-mono text-teal-300 sm:block">{t.console} →</Link></nav>
    </div></header>
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    <footer className="mx-auto max-w-3xl border-t border-white/10 px-5 py-8 text-center text-[11px] font-mono text-slate-400">VAAYU · 1 km intelligence · Multi-region demonstration</footer>
  </div>;
}

export default function CitizenLayout({ children }: { children: React.ReactNode }) {
  return <CitizenI18nProvider><CitizenChrome>{children}</CitizenChrome></CitizenI18nProvider>;
}
