"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Provenance } from "@/lib/schemas";

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
        label: "Map",
        icon: "◉",
        badge: "1 km",
      },
      {
        href: "/forecast",
        label: "Forecast",
        icon: "◉",
        badge: "72h",
      },
      {
        href: "/worklist",
        label: "Farm fires",
        icon: "◉",
        badge: "D-95",
      },
      {
        href: "/alerts",
        label: "Action notices",
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
    group: "",
    items: [
      {
        href: "/aqi",
        label: "My air",
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

type SidebarProps = {
  /**
   * The model behind the numbers, from /provenance. Null when the console could
   * not reach the API, which is reported as such rather than as a model name.
   */
  model?: Provenance["model"] | null;
};

export function Sidebar({ model }: SidebarProps) {
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
                </div>
                <div className="text-[8px] font-mono tracking-widest text-slate-400 uppercase">
                  AIR QUALITY INTELLIGENCE
                </div>
              </div>
            </div>
          </Link>

          {/* Region */}
          <div className="mt-4 p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
            <div className="text-xs font-mono font-semibold text-slate-200">
              Delhi NCR
            </div>
          </div>
        </div>

        {/* Navigation Sections */}
        <nav className="p-3 space-y-6">
          {NAV_GROUPS.map((section, idx) => (
            <div key={section.group || `nav-group-${idx}`}>
              {section.group ? (
                <div className="px-3 mb-2 text-[9px] font-mono font-bold tracking-wider text-slate-500 uppercase">
                  {section.group}
                </div>
              ) : null}
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
          {/* The model actually behind the numbers, not the one we would like
              to have. This read "VAAYU-XGB-v1" unconditionally, on every page of
              the enforcement console, while model_run held "seed" -- hand-written
              demo rows. No model has been trained: the Earth Engine credential
              that feeds the predictors has never been issued, so run_nowcast has
              never had inputs. An officer reading this footer was told a gradient
              boosted model stood behind an alert that a person had typed in.

              Now it reports what latestModel() found, and says plainly when that
              is seed data rather than a trained model. */}
          <div className="flex justify-between gap-2">
            <span className="text-slate-500">Model Engine:</span>
            {model?.version ? (
              <span
                className={
                  model.isTrainedModel
                    ? "text-slate-300 font-semibold"
                    : "text-amber-400 font-semibold"
                }
                title={
                  model.isTrainedModel
                    ? undefined
                    : "Seed data, not a trained model. Predictions are placeholders."
                }
              >
                {model.version}
                {model.isTrainedModel ? "" : " (seed)"}
              </span>
            ) : (
              <span className="text-amber-400 font-semibold">none trained</span>
            )}
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
          <span>For officials</span>
          <span className="text-slate-400">v1.0-ncr</span>
        </div>
      </div>
    </aside>
  );
}
