import Link from "next/link";

export default function CitizenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#080b0d] text-slate-100 font-sans antialiased selection:bg-teal-500/30 selection:text-teal-200">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-[#080b0d]/80 backdrop-blur-xl border-b border-white/10">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3.5">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 group-hover:border-teal-400 transition-colors">
              <svg
                className="w-4 h-4"
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
            <div>
              <div className="font-mono text-sm font-bold tracking-wider text-slate-100 flex items-center gap-1.5">
                <span>VAAYU</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-teal-950/80 border border-teal-800/60 text-teal-300 font-mono">
                  CITIZEN
                </span>
              </div>
              <div className="text-[8px] font-mono tracking-widest text-slate-400 uppercase">
                AIR QUALITY INTELLIGENCE
              </div>
            </div>
          </Link>

          <nav className="flex items-center gap-1 sm:gap-2">
            <Link
              href="/aqi"
              className="px-3 py-1.5 rounded-xl text-xs font-mono font-medium text-slate-200 hover:bg-white/[0.08] transition-colors"
            >
              My Air
            </Link>
            <Link
              href="/rankings"
              className="px-3 py-1.5 rounded-xl text-xs font-mono font-medium text-slate-400 hover:text-slate-200 hover:bg-white/[0.08] transition-colors"
            >
              Rankings
            </Link>
            <Link
              href="/report"
              className="px-3 py-1.5 rounded-xl text-xs font-mono font-medium text-slate-400 hover:text-slate-200 hover:bg-white/[0.08] transition-colors"
            >
              Report
            </Link>
            <div className="h-3 w-[1px] bg-white/10 mx-1 hidden sm:block" />
            <Link
              href="/map"
              className="px-3 py-1.5 rounded-xl text-xs font-mono font-medium bg-white/[0.06] hover:bg-white/[0.12] text-teal-300 border border-white/10 transition-colors hidden sm:flex items-center gap-1"
            >
              <span>Console</span>
              <span>→</span>
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="mx-auto max-w-3xl px-5 py-8 border-t border-white/10 text-center space-y-2">
        <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-mono text-slate-400">
          <span>VAAYU Decision Support</span>
          <span>·</span>
          <span>1 km PostGIS Surface</span>
          <span>·</span>
          <span>Delhi-NCR Pilot</span>
        </div>
        <p className="text-[11px] font-mono text-slate-400 max-w-lg mx-auto">
          Model estimates are decision support tools, not official measurements from statutory regulatory bodies.
        </p>
      </footer>
    </div>
  );
}
