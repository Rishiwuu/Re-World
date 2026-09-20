"use client";

import { useAppContext } from "./AppProvider";
import { Palette } from "lucide-react";
import ThemeModal from "./ThemeModal";

export function NavbarHeader() {
  const { setShowThemeModal, activeThemePack } = useAppContext();

  return (
    <>
      <header className="relative z-10 border-b border-white/10 dark:border-white/10 light:border-black/10 bg-black/20 dark:bg-black/20 light:bg-white/40 backdrop-blur-xl px-6 py-3.5 flex items-center justify-between shrink-0 shadow-lg">
        <div className="flex items-center gap-2.5">
          <div className="w-3 h-3 rounded-full bg-canon shadow-[0_0_12px_rgba(251,191,36,0.7)] animate-pulse"></div>
          <h1 className="font-mono text-xs tracking-widest uppercase font-bold text-primary">Re:World</h1>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex gap-4 font-mono text-xs text-primary-muted uppercase tracking-wider">
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Status: Online</span>
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span> Canon: Secure</span>
          </div>

          {/* Theme Button */}
          <button
            onClick={() => setShowThemeModal(true)}
            className="flex items-center gap-2 border border-white/20 dark:border-white/20 light:border-black/15 bg-white/10 dark:bg-white/10 light:bg-black/5 hover:bg-white/20 px-3 py-1.5 rounded-lg text-xs font-mono font-bold text-primary transition-all shadow-sm backdrop-blur-md"
            title="Change Theme & Texture Packs"
          >
            <Palette size={14} className="text-canon" />
            <span className="hidden xs:inline">Theme</span>
            <span className="w-3 h-3 rounded-full border border-white/30" style={{ background: activeThemePack.gradientPreview }} />
          </button>
        </div>
      </header>

      <ThemeModal />
    </>
  );
}
