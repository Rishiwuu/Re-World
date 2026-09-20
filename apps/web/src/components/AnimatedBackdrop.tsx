"use client";

import { ShaderGradient, ShaderGradientCanvas } from "@shadergradient/react";
import { useAppContext } from "./AppProvider";

export function AnimatedBackdrop() {
  const { activeThemePack, activeTextureMesh, isDarkMode } = useAppContext();

  // Mesh overlays based on selected texture mesh
  const getMeshStyle = () => {
    switch (activeTextureMesh) {
      case "matrix":
        return {
          backgroundImage: `
            linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)
          `,
          backgroundSize: "24px 24px",
        };
      case "starfield":
        return {
          backgroundImage: `
            radial-gradient(circle at 20% 30%, rgba(255,255,255,0.2) 1px, transparent 2px),
            radial-gradient(circle at 75% 15%, rgba(255,255,255,0.15) 1.5px, transparent 2px),
            radial-gradient(circle at 50% 70%, rgba(255,255,255,0.18) 1px, transparent 2px),
            radial-gradient(circle at 85% 80%, rgba(255,255,255,0.12) 1.5px, transparent 2px)
          `,
          backgroundSize: "120px 120px",
        };
      case "glass":
        return {
          backgroundImage: "none",
        };
      case "silk":
      default:
        return {
          backgroundImage: `
            repeating-linear-gradient(0deg, rgba(255,255,255,0.08) 0px, transparent 1px, transparent 3px),
            repeating-linear-gradient(90deg, rgba(255,255,255,0.04) 0px, transparent 1px, transparent 6px)
          `,
          backgroundSize: "6px 6px",
        };
    }
  };

  return (
    <div
      aria-hidden="true"
      className="shader-gradient-backdrop pointer-events-none fixed inset-0 z-0 overflow-hidden transition-colors duration-500"
      style={{ backgroundColor: activeThemePack.bgHex }}
    >
      {/* ── 3D ShaderGradient Canvas ───────────────────────────────────── */}
      <div className={`absolute inset-0 transition-opacity duration-500 ${isDarkMode ? 'opacity-95' : 'opacity-80'}`}>
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
            uSpeed={0.08}
            uStrength={0.65}
            uDensity={1.9}
            uFrequency={5.0}
            color1={activeThemePack.color1}
            color2={activeThemePack.color2}
            color3={activeThemePack.color3}
            brightness={isDarkMode ? 1.15 : 1.35}
            grain="off"
          />
        </ShaderGradientCanvas>
      </div>

      {/* ── Texture Mesh Overlay ────────────────────────────────────── */}
      <div
        className={`absolute inset-0 pointer-events-none mix-blend-overlay transition-all duration-500 ${isDarkMode ? 'opacity-25' : 'opacity-15'}`}
        style={getMeshStyle()}
      />

      {/* ── Ambient Radial Glows ───────────────────────────────────── */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-500"
        style={{
          background: isDarkMode ? `
            radial-gradient(ellipse 55% 45% at 75% 25%, ${activeThemePack.accentColor}33 0%, transparent 70%),
            radial-gradient(ellipse 70% 60% at 25% 75%, ${activeThemePack.color1}44 0%, transparent 80%),
            radial-gradient(ellipse 100% 100% at 50% 50%, transparent 40%, ${activeThemePack.bgHex}b3 100%)
          ` : `
            radial-gradient(ellipse 65% 55% at 75% 25%, ${activeThemePack.accentColor}22 0%, transparent 70%),
            radial-gradient(ellipse 80% 70% at 25% 75%, ${activeThemePack.color1}22 0%, transparent 80%)
          `,
        }}
      />
    </div>
  );
}
