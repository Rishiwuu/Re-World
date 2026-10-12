"use client";

import { useState } from "react";
import { useAppContext } from "./AppProvider";
import TimelineViz from "./TimelineViz";
import CharacterPanel from "./CharacterPanel";
import BranchLab from "./BranchLab";
import ScenarioVisualizerModal from "./ScenarioVisualizerModal";
import { WindowFrame, WindowState } from "./WindowFrame";
import { MessageSquare, GitBranch, Users, ArrowLeft, Sparkles } from "lucide-react";

export default function WorldDashboard() {
  const { 
    branchId, 
    currentSequence, 
    worldSummary, 
    setStoryId, 
    setBranchId, 
    setSelectedCharacterId,
    isDarkMode,
  } = useAppContext();

  const [showVisualizer, setShowVisualizer] = useState(false);

  // Desktop Floating Windows State
  const [windows, setWindows] = useState<Record<string, WindowState>>({
    chat: {
      id: "chat",
      title: "Character Interrogation & Chat",
      icon: <MessageSquare size={14} className="text-amber-400" />,
      isOpen: true,
      isMinimized: false,
      isMaximized: false,
      position: { x: 50, y: 80 },
      size: { width: 440, height: 560 },
      zIndex: 10,
    },
    branch: {
      id: "branch",
      title: "What-If Simulation Lab",
      icon: <GitBranch size={14} className="text-purple-400" />,
      isOpen: true,
      isMinimized: false,
      isMaximized: false,
      position: { x: 510, y: 80 },
      size: { width: 480, height: 580 },
      zIndex: 11,
    },
    dossier: {
      id: "dossier",
      title: "Entity Dossier Registry",
      icon: <Users size={14} className="text-teal-400" />,
      isOpen: false,
      isMinimized: false,
      isMaximized: false,
      position: { x: 280, y: 120 },
      size: { width: 460, height: 540 },
      zIndex: 12,
    },
  });

  const [maxZ, setMaxZ] = useState(15);

  if (!worldSummary) return null;

  const focusWindow = (id: string) => {
    const nextZ = maxZ + 1;
    setMaxZ(nextZ);
    setWindows(prev => ({
      ...prev,
      [id]: { ...prev[id], isOpen: true, isMinimized: false, zIndex: nextZ },
    }));
  };

  const toggleWindow = (id: string) => {
    setWindows(prev => {
      const target = prev[id];
      if (!target.isOpen) {
        const nextZ = maxZ + 1;
        setMaxZ(nextZ);
        return { ...prev, [id]: { ...target, isOpen: true, isMinimized: false, zIndex: nextZ } };
      } else if (target.isMinimized) {
        const nextZ = maxZ + 1;
        setMaxZ(nextZ);
        return { ...prev, [id]: { ...target, isMinimized: false, zIndex: nextZ } };
      } else {
        return { ...prev, [id]: { ...target, isOpen: false } };
      }
    });
  };

  const updateWindowBounds = (id: string, pos: { x: number; y: number }, size: { width: number; height: number }) => {
    setWindows(prev => ({
      ...prev,
      [id]: { ...prev[id], position: pos, size: size },
    }));
  };

  const handleMinimize = (id: string) => {
    setWindows(prev => ({
      ...prev,
      [id]: { ...prev[id], isMinimized: true },
    }));
  };

  const handleMaximize = (id: string) => {
    setWindows(prev => ({
      ...prev,
      [id]: { ...prev[id], isMaximized: !prev[id].isMaximized },
    }));
  };

  const handleClose = (id: string) => {
    setWindows(prev => ({
      ...prev,
      [id]: { ...prev[id], isOpen: false },
    }));
  };

  const isCanon = branchId === "canon";

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-transparent relative">
      {/* Top Controls Header */}
      <div className={`flex-none px-6 py-3 border-b flex flex-wrap items-center justify-between gap-4 z-30 transition-colors duration-300 ${
        isDarkMode 
          ? "border-white/10 bg-black/25 backdrop-blur-xl text-white shadow-lg" 
          : "border-slate-200 bg-white/95 text-slate-900 shadow-sm"
      }`}>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => {
              setStoryId(null);
              setBranchId("canon");
              setSelectedCharacterId(null);
            }}
            className={`flex items-center gap-1.5 text-xs font-mono border px-2.5 py-1.5 rounded transition-colors ${
              isDarkMode 
                ? "border-white/15 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white" 
                : "border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900"
            }`}
          >
            <ArrowLeft size={14} /> ARCHIVE
          </button>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-serif text-lg font-semibold tracking-wide">
                {worldSummary.story_id.replace(/_/g, " ").replace(/-/g, " ").toUpperCase()}
              </h2>
              <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded border uppercase ${
                isCanon 
                  ? (isDarkMode ? 'bg-canon/10 text-canon border-canon/30' : 'bg-amber-100 text-amber-800 border-amber-300')
                  : (isDarkMode ? 'bg-generated/10 text-generated border-generated/30 animate-pulse' : 'bg-purple-100 text-purple-800 border-purple-300 animate-pulse')
              }`}>
                {isCanon ? "CANON TIMELINE" : `BRANCH: ${branchId.substring(0, 8)}`}
              </span>
            </div>

            <div className={`text-xs font-mono flex items-center gap-4 mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              <span>Seq: <strong>{currentSequence}</strong> / {worldSummary.current_sequence}</span>
              <span>•</span>
              <span>Entities: <strong>{worldSummary.character_count}</strong></span>
              <span>•</span>
              <span>Events: <strong>{worldSummary.event_count}</strong></span>
              <span>•</span>
              <span>Facts: <strong>{worldSummary.knowledge_count}</strong></span>
            </div>
          </div>
        </div>

        {/* Global Action Tools */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowVisualizer(true)}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg border font-mono text-xs font-semibold transition-all shadow-md group cursor-whatif ${
              isDarkMode
                ? "border-purple-500/40 bg-purple-500/20 text-purple-200 hover:bg-purple-500/30"
                : "border-purple-300 bg-purple-100 text-purple-900 hover:bg-purple-200"
            }`}
            title="Synthesize AI Visual for active timeline scenario"
          >
            <Sparkles size={14} className={`${isDarkMode ? 'text-purple-300' : 'text-purple-700'} animate-pulse group-hover:rotate-12 transition-transform`} />
            <span>Visualize Scenario</span>
          </button>

          {/* Window Taskbar Launch Buttons */}
          <div className={`flex border rounded-lg p-1 gap-1 ${
            isDarkMode ? "bg-black/40 border-white/15" : "bg-slate-100 border-slate-300"
          }`}>
            <button
              onClick={() => toggleWindow("chat")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono transition-all cursor-character ${
                windows.chat.isOpen && !windows.chat.isMinimized
                  ? (isDarkMode ? "bg-amber-500/30 text-amber-200 border border-amber-400/40 font-semibold shadow-md" : "bg-amber-600 text-white font-semibold shadow-md")
                  : (isDarkMode ? "text-slate-400 hover:text-white hover:bg-white/10" : "text-slate-600 hover:text-slate-900 hover:bg-slate-200")
              }`}
            >
              <MessageSquare size={14} />
              Character Chat
            </button>
            <button
              onClick={() => toggleWindow("branch")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono transition-all cursor-branch ${
                windows.branch.isOpen && !windows.branch.isMinimized
                  ? (isDarkMode ? "bg-purple-500/30 text-purple-200 border border-purple-400/40 font-semibold shadow-md" : "bg-purple-700 text-white font-semibold shadow-md")
                  : (isDarkMode ? "text-slate-400 hover:text-white hover:bg-white/10" : "text-slate-600 hover:text-slate-900 hover:bg-slate-200")
              }`}
            >
              <GitBranch size={14} />
              What-If Lab
            </button>
            <button
              onClick={() => toggleWindow("dossier")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono transition-all cursor-dossier ${
                windows.dossier.isOpen && !windows.dossier.isMinimized
                  ? (isDarkMode ? "bg-teal-500/30 text-teal-200 border border-teal-400/40 font-semibold shadow-md" : "bg-teal-700 text-white font-semibold shadow-md")
                  : (isDarkMode ? "text-slate-400 hover:text-white hover:bg-white/10" : "text-slate-600 hover:text-slate-900 hover:bg-slate-200")
              }`}
            >
              <Users size={14} />
              Dossier
            </button>
          </div>
        </div>
      </div>

      {/* Main Workspace Stage: Timeline Canvas as full background */}
      <div className="flex-1 min-h-0 w-full relative overflow-hidden bg-transparent flex flex-col">
        <TimelineViz />

        {/* Floating Desktop Windows Layer */}
        {windows.chat.isOpen && (
          <WindowFrame
            win={windows.chat}
            onClose={() => handleClose("chat")}
            onMinimize={() => handleMinimize("chat")}
            onMaximize={() => handleMaximize("chat")}
            onFocus={() => focusWindow("chat")}
            onUpdateBounds={(pos, size) => updateWindowBounds("chat", pos, size)}
          >
            <CharacterPanel initialTab="chat" />
          </WindowFrame>
        )}

        {windows.branch.isOpen && (
          <WindowFrame
            win={windows.branch}
            onClose={() => handleClose("branch")}
            onMinimize={() => handleMinimize("branch")}
            onMaximize={() => handleMaximize("branch")}
            onFocus={() => focusWindow("branch")}
            onUpdateBounds={(pos, size) => updateWindowBounds("branch", pos, size)}
          >
            <BranchLab />
          </WindowFrame>
        )}

        {windows.dossier.isOpen && (
          <WindowFrame
            win={windows.dossier}
            onClose={() => handleClose("dossier")}
            onMinimize={() => handleMinimize("dossier")}
            onMaximize={() => handleMaximize("dossier")}
            onFocus={() => focusWindow("dossier")}
            onUpdateBounds={(pos, size) => updateWindowBounds("dossier", pos, size)}
          >
            <CharacterPanel initialTab="dossier" />
          </WindowFrame>
        )}
      </div>

      {/* Bottom Desktop Taskbar for Minimized App Windows */}
      <div className={`flex-none px-6 py-2 border-t flex items-center justify-between z-30 transition-colors ${
        isDarkMode ? "border-white/10 bg-black/40 text-slate-400" : "border-slate-200 bg-slate-100/90 text-slate-600"
      }`}>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-wider font-semibold">Active Windows:</span>
          {Object.values(windows).map(win => (
            <button
              key={win.id}
              onClick={() => toggleWindow(win.id)}
              className={`flex items-center gap-1.5 text-xs font-mono px-3 py-1 rounded border transition-all ${
                win.isOpen && !win.isMinimized
                  ? (isDarkMode ? "border-white/30 bg-white/15 text-white font-bold" : "border-slate-400 bg-white text-slate-900 font-bold shadow-sm")
                  : win.isOpen && win.isMinimized
                  ? (isDarkMode ? "border-white/10 bg-white/5 text-slate-400" : "border-slate-300 bg-slate-200 text-slate-600")
                  : (isDarkMode ? "border-transparent text-slate-600 hover:text-slate-400" : "border-transparent text-slate-400 hover:text-slate-700")
              }`}
            >
              {win.icon}
              <span>{win.id.toUpperCase()}</span>
              {win.isMinimized && <span className="text-[9px] opacity-60">(min)</span>}
            </button>
          ))}
        </div>

        <div className="text-[10px] font-mono opacity-70 hidden sm:block">
          Click window titles to drag • Pull edges to resize • Timeline remains interactive background
        </div>
      </div>

      {/* Scenario AI Visualizer Modal */}
      <ScenarioVisualizerModal
        isOpen={showVisualizer}
        onClose={() => setShowVisualizer(false)}
      />
    </div>
  );
}
