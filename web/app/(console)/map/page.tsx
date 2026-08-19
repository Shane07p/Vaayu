/**
 * 1 km PM2.5 surface with fire clusters and station overlay.
 *
 * TODO(member-4): render MapShell with deck.gl layers over MapLibre.
 * The map component must be imported with `ssr: false` — WebGL cannot render
 * on the server. Low-coverage cells should read as visibly uncertain rather
 * than being drawn the same as well-observed ones.
 */

export default function MapPage() {
  return (
    <main className="mx-auto max-w-7xl space-y-2 p-6">
      <h1 className="text-2xl font-semibold">1 km PM2.5 surface</h1>
      <p className="text-sm text-muted-foreground">
        Model estimate with per-cell uncertainty. Not a measurement.
      </p>
    </main>
  );
}
