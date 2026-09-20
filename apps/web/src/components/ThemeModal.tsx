"use client";

import { useAppContext } from "./AppProvider";
import { THEME_PACKS } from "@/lib/themes";
import { Palette, Sun, Moon, Check, X, Sparkles, Grid } from "lucide-react";

export default function ThemeModal() {
  const {
    showThemeModal,
    setShowThemeModal,
    isDarkMode,
    toggleDarkMode,
    activeThemePackId,
    setActiveThemePackId,
    activeTextureMesh,
    setActiveTextureMesh,
  } = useAppContext();

  if (!showThemeModal) return null;

  const meshOptions = [
    { id: "silk", name: "Woven Silk", desc: "Fine line overlay" },
    { id: "matrix", name: "Cyber Matrix", desc: "Grid coordinates" },
    { id: "starfield", name: "Star Dust", desc: "Celestial speckles" },
    { id: "glass", name: "Smooth Glass", desc: "Pure liquid surface" },
  ];

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-200 ${isDarkMode ? "bg-black/60" : "bg-slate-900/30"}`}>
      <div 
        className={`max-w-2xl w-full border rounded-2xl p-6 sm:p-7 shadow-2xl backdrop-blur-2xl flex flex-col gap-6 relative max-h-[90vh] overflow-y-auto ${
          isDarkMode 
            ? "bg-slate-950/90 border-white/15 text-white" 
            : "bg-white/95 border-slate-200 text-slate-900 shadow-xl"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center justify-between border-b pb-4 ${isDarkMode ? "border-white/10" : "border-slate-200"}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center text-canon shadow-inner ${isDarkMode ? "bg-white/10 border-white/15" : "bg-slate-100 border-slate-200"}`}>
              <Palette size={20} />
            </div>
            <div>
              <h2 className={`text-lg font-serif font-bold flex items-center gap-2 ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                Atmospheric Theme & Texture Packs
              </h2>
              <p className={`text-xs font-mono ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
                Customize 3D ShaderGradient canvas, dark/light mode & background mesh textures
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowThemeModal(false)}
            className={`p-2 rounded-lg transition-colors ${isDarkMode ? "text-slate-400 hover:text-white hover:bg-white/10" : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"}`}
          >
            <X size={18} />
          </button>
        </div>

        {/* Light Mode / Dark Mode Switch */}
        <div className={`border rounded-xl p-4 flex items-center justify-between ${isDarkMode ? "bg-white/5 border-white/10" : "bg-slate-50 border-slate-200"}`}>
          <div className="flex items-center gap-3">
            {isDarkMode ? (
              <Moon size={18} className="text-purple-400 animate-pulse" />
            ) : (
              <Sun size={18} className="text-amber-500 animate-spin-slow" />
            )}
            <div>
              <div className={`text-xs font-mono font-bold uppercase tracking-wider ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                Display Mode: {isDarkMode ? "Dark Atmosphere" : "Light Atmosphere"}
              </div>
              <div className={`text-[11px] font-mono ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
                {isDarkMode ? "Deep midnight contrasts & glowing glass" : "Crisp silver background & high legibility typography"}
              </div>
            </div>
          </div>

          <button
            onClick={toggleDarkMode}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-xs font-mono font-bold transition-all shadow-sm ${
              isDarkMode 
                ? "border-white/20 bg-white/10 hover:bg-white/20 text-white" 
                : "border-slate-300 bg-white hover:bg-slate-100 text-slate-900"
            }`}
          >
            {isDarkMode ? (
              <><Sun size={14} className="text-amber-400" /> Switch to Light Mode</>
            ) : (
              <><Moon size={14} className="text-purple-600" /> Switch to Dark Mode</>
            )}
          </button>
        </div>

        {/* Texture-Gradient Packs Grid */}
        <div className="space-y-3">
          <div className={`text-xs font-mono uppercase tracking-wider flex items-center justify-between ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
            <span className="flex items-center gap-1.5"><Sparkles size={13} className="text-canon" /> Texture-Gradient Packs ({THEME_PACKS.length})</span>
            <span className="text-[10px] opacity-70">Click to apply pack</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {THEME_PACKS.map((pack) => {
              const isActive = pack.id === activeThemePackId;
              return (
                <button
                  key={pack.id}
                  onClick={() => setActiveThemePackId(pack.id)}
                  className={`text-left p-3.5 rounded-xl border transition-all flex flex-col justify-between gap-3 relative overflow-hidden group ${
                    isActive
                      ? "border-canon bg-amber-500/10 shadow-md"
                      : isDarkMode
                      ? "border-white/10 bg-black/20 hover:border-white/25 hover:bg-white/5"
                      : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white shadow-sm"
                  }`}
                >
                  {/* Swatch Header Preview */}
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-7 h-7 rounded-lg border border-white/20 shadow-md shrink-0 transition-transform group-hover:scale-105"
                        style={{ background: pack.gradientPreview }}
                      />
                      <div>
                        <div className={`text-xs font-serif font-bold group-hover:text-canon transition-colors ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                          {pack.name}
                        </div>
                        <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border uppercase ${isDarkMode ? "bg-white/5 border-white/10 text-slate-400" : "bg-slate-200 border-slate-300 text-slate-700"}`}>
                          {pack.mode}
                        </span>
                      </div>
                    </div>

                    {isActive && (
                      <div className="w-5 h-5 rounded-full bg-canon text-black flex items-center justify-center shrink-0 shadow-md">
                        <Check size={12} strokeWidth={3} />
                      </div>
                    )}
                  </div>

                  <p className={`text-[11px] font-mono line-clamp-2 leading-relaxed ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
                    {pack.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Texture Mesh Options */}
        <div className="space-y-3">
          <div className={`text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
            <Grid size={13} className="text-canon" /> Background Mesh Overlay
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {meshOptions.map((mesh) => {
              const isActive = activeTextureMesh === mesh.id;
              return (
                <button
                  key={mesh.id}
                  onClick={() => setActiveTextureMesh(mesh.id)}
                  className={`p-2.5 rounded-lg border text-center transition-all ${
                    isActive
                      ? "border-canon bg-canon/10 text-canon font-bold"
                      : isDarkMode
                      ? "border-white/10 bg-black/20 text-slate-400 hover:border-white/20 hover:text-white"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:text-slate-900 hover:bg-white"
                  }`}
                >
                  <div className="text-xs font-mono">{mesh.name}</div>
                  <div className="text-[9px] font-mono opacity-70 mt-0.5">{mesh.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className={`border-t pt-4 flex justify-end ${isDarkMode ? "border-white/10" : "border-slate-200"}`}>
          <button
            onClick={() => setShowThemeModal(false)}
            className="bg-canon text-black font-mono text-xs uppercase font-bold py-2.5 px-6 rounded-xl hover:bg-amber-400 transition-colors shadow-md"
          >
            Apply Theme
          </button>
        </div>
      </div>
    </div>
  );
}
