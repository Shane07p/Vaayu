import Link from "next/link";

/** Landing page: routes visitors to whichever surface they belong on. */
export default function Home() {
  return (
    <main className="mx-auto max-w-2xl space-y-6 p-10">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">VAAYU</h1>
        <p className="mt-2 text-muted-foreground">
          Forecast-driven air quality intelligence that terminates in statutory
          action.
        </p>
      </div>
      <div className="flex gap-4">
        <Link href="/aqi" className="rounded border px-4 py-2 hover:bg-accent">
          Check my air
        </Link>
        <Link href="/map" className="rounded border px-4 py-2 hover:bg-accent">
          Authority console
        </Link>
      </div>
    </main>
  );
}
