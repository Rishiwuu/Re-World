"use client";

import { useAppContext } from "./AppProvider";
import { Palette, Sun, Moon } from "lucide-react";
import ThemeModal from "./ThemeModal";

export function NavbarHeader() {
  const { setShowThemeModal, activeThemePack, isDarkMode, toggleDarkMode } = useAppContext();

  return (
    <>
      <header className={`relative z-10 border-b px-6 py-3 flex items-center justify-between shrink-0 transition-colors duration-300 ${
        isDarkMode 
          ? "border-white/10 bg-black/25 backdrop-blur-xl text-white shadow-lg" 
          : "border-slate-200 bg-white/90 text-slate-900 shadow-sm"
      }`}>
        <div className="flex items-center gap-2.5">
          <div className="w-3 h-3 rounded-full bg-canon shadow-[0_0_12px_rgba(251,191,36,0.7)] animate-pulse"></div>
          <h1 className="font-mono text-xs tracking-widest uppercase font-bold text-primary">Re:World</h1>
        </div>

        <div className="flex items-center gap-3">
          <div className={`hidden sm:flex gap-4 font-mono text-xs uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Status: Online</span>
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Canon: Secure</span>
          </div>

          {/* Light / Dark Mode Fast Toggle Button */}
          <button
            onClick={toggleDarkMode}
            className={`p-1.5 rounded-lg border text-xs transition-colors flex items-center justify-center ${
              isDarkMode 
                ? "border-white/15 bg-white/5 hover:bg-white/10 text-purple-300" 
                : "border-slate-200 bg-slate-100 hover:bg-slate-200 text-amber-600"
            }`}
            title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDarkMode ? <Sun size={15} /> : <Moon size={15} />}
          </button>

          {/* Theme Button */}
          <button
            onClick={() => setShowThemeModal(true)}
            className={`flex items-center gap-2 border px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all shadow-sm ${
              isDarkMode
                ? "border-white/20 bg-white/10 hover:bg-white/20 text-white"
                : "border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-900"
            }`}
            title="Change Theme & Texture Packs"
          >
            <Palette size={14} className="text-canon" />
            <span className="hidden xs:inline">Theme</span>
            <span className="w-3 h-3 rounded-full border border-black/20 dark:border-white/30 shrink-0" style={{ background: activeThemePack.gradientPreview }} />
          </button>
        </div>
      </header>

      <ThemeModal />
    </>
  );
}
