/**
 * Authority console shell.
 *
 * Intended for CAQM, DPCC, and District Magistrate users. Auth-gated in
 * deployment; currently open, see backend SecurityConfig.
 */

import Link from "next/link";

const NAV = [
  { href: "/map", label: "Map" },
  { href: "/forecast", label: "Forecast" },
  { href: "/worklist", label: "Worklist" },
  { href: "/alerts", label: "Alerts" },
];

export default function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-6 py-4">
          <span className="font-semibold tracking-tight">VAAYU Console</span>
          <nav className="flex gap-4 text-sm">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="hover:underline">
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
