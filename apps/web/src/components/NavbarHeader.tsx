"use client";

import { useAppContext } from "./AppProvider";
import { Palette } from "lucide-react";

export function NavbarHeader() {
  const { setShowThemeModal, activeThemePack, isDarkMode } = useAppContext();

  return (
    <header className={`relative z-20 border-b px-6 py-2.5 flex items-center justify-between shrink-0 transition-colors duration-300 backdrop-blur-xl ${
      isDarkMode 
        ? "border-white/10 bg-black/30 text-white shadow-md" 
        : "border-slate-200 bg-white/90 text-slate-900 shadow-sm"
    }`}>
      {/* Left: Re:World */}
      <div className="flex items-center gap-2.5">
        <div className="w-2.5 h-2.5 rounded-full bg-canon shadow-[0_0_10px_rgba(251,191,36,0.8)] animate-pulse" />
        <h1 className="font-mono text-xs tracking-widest uppercase font-bold text-foreground">Re:World</h1>
      </div>

      {/* Right: Theme Button */}
      <button
        onClick={() => setShowThemeModal(true)}
        className={`flex items-center gap-2 border px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all shadow-sm ${
          isDarkMode
            ? "border-white/20 bg-white/10 hover:bg-white/20 text-white"
            : "border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-900"
        }`}
        title="Change Theme & Texture Atmosphere"
      >
        <Palette size={14} className="text-canon" />
        <span>Theme</span>
        <span className="w-2.5 h-2.5 rounded-full border border-black/20 dark:border-white/30 shrink-0" style={{ background: activeThemePack.gradientPreview }} />
      </button>
    </header>
  );
}
