import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { AtmosphericBackground } from "@/components/citizen/atmospheric-background";

export default function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
      <Sidebar />

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
