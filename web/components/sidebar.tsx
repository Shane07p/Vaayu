"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  badge?: string;
  external?: boolean;
}

interface NavGroup {
  group: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    group: "OVERVIEW",
    items: [
      {
        href: "/map",
        label: "Situation Map",
        icon: "◉",
        badge: "1 km",
      },
      {
        href: "/forecast",
        label: "Forecast Intelligence",
        icon: "◉",
        badge: "72h",
      },
      {
        href: "/worklist",
        label: "Fire Worklist",
        icon: "◉",
        badge: "D-95",
      },
      {
        href: "/alerts",
        label: "Statutory Alerts",
        icon: "◉",
        badge: "GRAP",
      },
    ],
  },
  {
    group: "MONITORING",
    items: [
      {
        href: "/map?layer=stations",
        label: "CPCB Stations",
        icon: "◉",
        badge: "Active",
      },
      {
        href: "/map?layer=fires",
        label: "FIRMS Satellite",
        icon: "◉",
        badge: "VIIRS",
      },
    ],
  },
  {
    group: "CITIZEN SURFACE",
    items: [
      {
        href: "/aqi",
        label: "Check My Air",
        icon: "◉",
        external: true,
      },
      {
        href: "/report",
        label: "Submit Observation",
        icon: "◉",
        external: true,
      },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 flex-shrink-0 flex flex-col justify-between bg-[#070a0e]/95 backdrop-blur-xl border-r border-white/10 min-h-screen text-slate-300 select-none z-30">
      <div>
        {/* Brand Header */}
        <div className="p-5 border-b border-white/10">
          <Link href="/" className="group block">
            <div className="flex items-center gap-3">
              {/* Atmospheric wind/radar minimalist mark */}
              <div className="w-8 h-8 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center text-slate-200 group-hover:border-white/25 transition-all">
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
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-base font-bold tracking-wider text-white">
                    VAAYU
                  </span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/[0.08] border border-white/10 text-slate-300 font-mono">
                    PROD
                  </span>
                </div>
                <div className="text-[8px] font-mono tracking-widest text-slate-400 uppercase">
                  AIR QUALITY INTELLIGENCE
                </div>
              </div>
            </div>
            <div className="mt-2 text-[10px] font-mono text-slate-500 flex items-center gap-1">
              <span>Forecast</span>
              <span>→</span>
              <span>Attribution</span>
              <span>→</span>
              <span>Action</span>
            </div>
          </Link>

          {/* Operational Region Banner */}
          <div className="mt-4 p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between">
            <div>
              <div className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">
                Region Pilot
              </div>
              <div className="text-xs font-mono font-semibold text-slate-200">
                DELHI-NCR
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-[10px] font-mono text-emerald-400 font-medium uppercase">
                Active
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Sections */}
        <nav className="p-3 space-y-6">
          {NAV_GROUPS.map((section) => (
            <div key={section.group}>
              <div className="px-3 mb-2 text-[9px] font-mono font-bold tracking-wider text-slate-500 uppercase">
                {section.group}
              </div>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const isActive = !item.external && pathname === item.href.split("?")[0];
                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                        isActive
                          ? "bg-white/[0.08] text-white border border-white/15 shadow-sm font-semibold"
                          : "text-slate-400 hover:text-slate-100 hover:bg-white/[0.04] border border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`text-xs ${
                            isActive ? "text-slate-200" : "text-slate-600"
                          }`}
                        >
                          {item.icon}
                        </span>
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-mono uppercase ${
                            isActive
                              ? "bg-white/[0.12] text-slate-200 border border-white/10"
                              : "bg-white/[0.04] text-slate-500 border border-white/5"
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* System Status Footer */}
      <div className="p-4 border-t border-white/10 bg-[#070a0e]/50">
        <div className="space-y-1.5 text-[10px] font-mono text-slate-400">
          <div className="flex justify-between">
            <span className="text-slate-500">Model Engine:</span>
            <span className="text-slate-300 font-semibold">VAAYU-XGB-v1</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Statutory Loop:</span>
            <span className="text-slate-300 font-medium">CAQM GRAP</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Grid Resolution:</span>
            <span className="text-slate-300">1 km PostGIS</span>
          </div>
        </div>
        <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-500 font-mono">
          <span>Authority Console</span>
          <span className="text-slate-400">v1.0-ncr</span>
        </div>
      </div>
    </aside>
  );
}
