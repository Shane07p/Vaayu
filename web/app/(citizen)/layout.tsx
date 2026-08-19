/**
 * Public citizen shell.
 *
 * Server-rendered for fast first paint on mobile. No auth.
 */

import Link from "next/link";

export default function CitizenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="mx-auto flex max-w-2xl items-center gap-6 px-6 py-4">
          <span className="font-semibold tracking-tight">VAAYU</span>
          <nav className="flex gap-4 text-sm">
            <Link href="/aqi" className="hover:underline">My air</Link>
            <Link href="/report" className="hover:underline">Report</Link>
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
