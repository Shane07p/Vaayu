import { Sidebar } from "@/components/sidebar";
import { fetchProvenance } from "@/lib/api";
import type { Provenance } from "@/lib/schemas";
import { Topbar } from "@/components/topbar";
import { AtmosphericBackground } from "@/components/citizen/atmospheric-background";

/**
 * The console footer names the model behind every figure on screen, so the
 * layout reads it rather than the sidebar asserting one. A failure here is not
 * fatal to the console: the sidebar reports the model as unknown and the pages
 * still render.
 */
export default async function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let model: Provenance["model"] | null = null;
  try {
    model = (await fetchProvenance()).model;
  } catch {
    // Reported as "none trained" rather than as a name nobody verified.
  }

  return (
    <div className="relative flex min-h-screen bg-[#070a0e] text-slate-100 antialiased font-sans">
      {/* Underlying Atmospheric Blurred Background Layer */}
      <AtmosphericBackground
        imageSrc="/backgrounds/normal.png"
        overlayOpacity={0.92}
        blur={28}
        className="fixed inset-0"
      />

      {/* Fixed Desktop Sidebar */}
      <Sidebar model={model} />

      {/* Main Console Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-transparent relative z-10">
        <Topbar />
        <div className="flex-1 p-6 md:p-8 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
