"use client";

import { ShaderGradient, ShaderGradientCanvas } from "@shadergradient/react";

/** 
 * A rich 3D ShaderGradient backdrop matching the violet/purple wave canvas
 * with vibrant crimson streak aesthetics from the reference image.
 */
export function AnimatedBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="shader-gradient-backdrop pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#090611]"
    >
      {/* ── 3D ShaderGradient Canvas ───────────────────────────────────── */}
      <div className="absolute inset-0 opacity-95">
        <ShaderGradientCanvas
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
          }}
          pixelDensity={1.2}
          fov={45}
          pointerEvents="none"
        >
          <ShaderGradient
            animate="on"
            type="waterPlane"
            shader="defaults"
            cDistance={2.8}
            cPolarAngle={105}
            cAzimuthAngle={155}
            uSpeed={0.09}
            uStrength={0.65}
            uDensity={1.9}
            uFrequency={5.0}
            color1="#3b0764"
            color2="#180b2b"
            color3="#f43f5e"
            brightness={1.15}
            grain="off"
          />
        </ShaderGradientCanvas>
      </div>

      {/* ── Woven Silk / Fine Line Mesh Overlay (mimicking Image 2 texture) ─ */}
      <div
        className="absolute inset-0 opacity-25 pointer-events-none mix-blend-overlay"
        style={{
          backgroundImage: `
            repeating-linear-gradient(0deg, rgba(255,255,255,0.08) 0px, transparent 1px, transparent 3px),
            repeating-linear-gradient(90deg, rgba(255,255,255,0.04) 0px, transparent 1px, transparent 6px)
          `,
          backgroundSize: "6px 6px",
        }}
      />

      {/* ── Ambient Radial Glows for Atmospheric Depth ────────────────── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 55% 45% at 75% 25%, rgba(244, 63, 94, 0.18) 0%, transparent 70%),
            radial-gradient(ellipse 70% 60% at 25% 75%, rgba(147, 51, 234, 0.22) 0%, transparent 80%),
            radial-gradient(ellipse 100% 100% at 50% 50%, transparent 40%, rgba(9, 6, 17, 0.65) 100%)
          `,
        }}
      />
    </div>
  );
}
