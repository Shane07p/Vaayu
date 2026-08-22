"use client";

interface AtmosphericBackgroundProps {
  imageSrc: string;
  overlayOpacity?: number;
  blur?: number;
  className?: string;
}

export function AtmosphericBackground({
  imageSrc,
  overlayOpacity = 0.78,
  blur = 20,
  className = "",
}: AtmosphericBackgroundProps) {
  return (
    <div
      className={`absolute inset-0 overflow-hidden pointer-events-none select-none rounded-[inherit] -z-10 ${className}`}
      aria-hidden="true"
    >
      {/* 1. Underlying Blurred & Scaled Image Layer */}
      <div
        className="absolute inset-[-15px] bg-cover bg-center transition-all duration-1000 ease-out"
        style={{
          backgroundImage: `url(${imageSrc})`,
          filter: `blur(${blur}px) saturate(0.65)`,
          transform: "scale(1.08)",
          opacity: 0.35,
        }}
      />

      {/* 2. Dark Atmospheric Tint Overlay */}
      <div
        className="absolute inset-0 bg-[#080b0d]"
        style={{ opacity: overlayOpacity }}
      />

      {/* 3. Radial Vignette for Content Readability */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(8,11,13,0.4)_0%,rgba(8,11,13,0.95)_100%)]" />

      {/* 4. Directional Gradient to smoothly blend edges */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#080b0d]/50 via-transparent to-[#080b0d]/90" />
    </div>
  );
}
