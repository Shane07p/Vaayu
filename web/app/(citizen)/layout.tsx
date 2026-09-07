"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LanguageSelector } from "@/components/citizen/language-selector";
import { CitizenI18nProvider, useCitizenI18n } from "@/lib/i18n";

function CitizenChrome({ children }: { children: React.ReactNode }) {
  const { t } = useCitizenI18n();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isAqiMap = pathname === "/aqi" || pathname === "/aqi/";

  const navItems = [
    {
      href: "/aqi",
      label: t.myAir,
      active: pathname === "/aqi" || pathname === "/aqi/",
      icon: (
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      href: "/rankings",
      label: t.rankings,
      active: pathname?.startsWith("/rankings"),
      icon: (
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      href: "/report",
      label: t.report,
      active: pathname?.startsWith("/report"),
      icon: (
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-[#070a0e] text-slate-100 font-sans antialiased selection:bg-teal-500/20 selection:text-teal-200">
      {/* Modern Translucent Frosted Glass Navbar */}
      <header className="sticky top-0 z-40 w-full border-b border-white/[0.08] bg-[#070a0e]/75 backdrop-blur-2xl shadow-[0_4px_30px_rgba(0,0,0,0.35)] transition-all">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Brand Logo */}
          <Link href="/" className="group flex items-center gap-3 transition-transform duration-200 hover:scale-[1.01]">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-teal-500/30 bg-gradient-to-tr from-teal-500/20 via-emerald-500/15 to-cyan-500/25 shadow-[0_0_15px_rgba(20,184,166,0.25)] transition-all duration-300 group-hover:border-teal-400/50 group-hover:shadow-[0_0_20px_rgba(20,184,166,0.4)]">
              <svg
                className="h-5 w-5 text-teal-300 transition-transform duration-300 group-hover:rotate-6"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2" />
                <path d="M9.6 4.6A2 2 0 1 1 11 8H2" />
                <path d="M12.6 19.4A2 2 0 1 0 14 16H2" />
              </svg>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-sans text-base font-bold tracking-tight text-white transition-colors group-hover:text-teal-100">
                  VAAYU
                </span>
                <span className="inline-flex items-center rounded-full border border-teal-500/20 bg-teal-500/10 px-2 py-0.5 text-[9px] font-medium text-teal-300">
                  Air Intelligence
                </span>
              </div>
              <span className="hidden sm:block text-[9px] font-mono uppercase tracking-widest text-slate-400">
                Delhi NCR · Punjab · Haryana
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Pill */}
          <nav className="hidden md:flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] p-1.5 backdrop-blur-xl shadow-inner">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium transition-all duration-200 ${
                  item.active
                    ? "border border-white/10 bg-white/15 text-white shadow-[0_2px_10px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.2)]"
                    : "text-slate-400 hover:bg-white/[0.06] hover:text-slate-100"
                }`}
              >
                <span className={item.active ? "text-teal-300" : "text-slate-400"}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>

          {/* Right Utilities: Language Selector & For Officials */}
          <div className="flex items-center gap-3">
            <LanguageSelector />

            <div className="hidden h-4 w-px bg-white/10 sm:block" />

            <Link
              href="/map"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-medium text-emerald-300 transition-all duration-200 hover:border-emerald-500/50 hover:bg-emerald-500/20 hover:text-emerald-100 hover:shadow-[0_0_15px_rgba(16,185,129,0.25)]"
            >
              <span>{t.console}</span>
              <svg
                className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>

            {/* Mobile Hamburger Toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="inline-flex md:hidden items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] p-2 text-slate-300 hover:bg-white/[0.08] hover:text-white transition-colors"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/[0.08] bg-[#070a0e]/95 px-4 py-4 backdrop-blur-2xl space-y-2">
            <div className="flex flex-col space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-medium transition-all ${
                    item.active
                      ? "border border-teal-500/30 bg-teal-500/15 text-teal-200"
                      : "text-slate-300 hover:bg-white/[0.05] hover:text-white"
                  }`}
                >
                  <span className={item.active ? "text-teal-300" : "text-slate-400"}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </Link>
              ))}
              <Link
                href="/map"
                onClick={() => setMobileMenuOpen(false)}
                className="mt-2 flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20"
              >
                <span>{t.console}</span>
                <span>→</span>
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      {isAqiMap ? (
        <main className="w-full">{children}</main>
      ) : (
        <main className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      )}

      {/* Static footer only for document pages (rankings / report) */}
      {!isAqiMap && (
        <footer className="mx-auto max-w-3xl border-t border-white/10 px-5 py-8 text-center text-[11px] font-mono text-slate-400">
          VAAYU · Clean Air Intelligence · India
        </footer>
      )}
    </div>
  );
}

export default function CitizenLayout({ children }: { children: React.ReactNode }) {
  return <CitizenI18nProvider><CitizenChrome>{children}</CitizenChrome></CitizenI18nProvider>;
}
