"use client";

import { useState } from "react";
import { useAppContext } from "./AppProvider";
import TimelineViz from "./TimelineViz";
import CharacterPanel from "./CharacterPanel";
import BranchLab from "./BranchLab";
import ScenarioVisualizerModal from "./ScenarioVisualizerModal";
import { MessageSquare, GitBranch, Users, ArrowLeft, RefreshCw, Sparkles, Palette } from "lucide-react";
import { api } from "@/lib/api";

export default function WorldDashboard() {
  const { 
    storyId, 
    branchId, 
    currentSequence, 
    worldSummary, 
    setStoryId, 
    setBranchId, 
    setSelectedCharacterId,
    setWorldSummary,
    setShowThemeModal,
    activeThemePack,
  } = useAppContext();

  const [activeTab, setActiveTab] = useState<"chat" | "branch" | "entities">("chat");
  const [refreshing, setRefreshing] = useState(false);
  const [showVisualizer, setShowVisualizer] = useState(false);

  if (!worldSummary) return null;

  const handleReloadSummary = async () => {
    if (!storyId) return;
    try {
      setRefreshing(true);
      const summary = await api.getWorldSummary(storyId, branchId);
      setWorldSummary(summary);
    } catch (err) {
      console.error(err);
    } finally {
      setRefreshing(false);
    }
  };

  const isCanon = branchId === "canon";

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-transparent">
      {/* Top Header Bar */}
      <div className="flex-none px-6 py-3 border-b border-white/10 bg-black/25 backdrop-blur-xl flex flex-wrap items-center justify-between gap-4 z-20">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => {
              setStoryId(null);
              setBranchId("canon");
              setSelectedCharacterId(null);
            }}
            className="flex items-center gap-1.5 text-xs font-mono text-primary-muted hover:text-primary border border-white/15 px-2.5 py-1.5 rounded transition-colors bg-white/5 hover:bg-white/10 backdrop-blur-md"
          >
            <ArrowLeft size={14} /> ARCHIVE
          </button>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-serif text-lg font-semibold text-primary tracking-wide">
                {worldSummary.story_id.replace(/_/g, " ").replace(/-/g, " ").toUpperCase()}
              </h2>
              <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded border uppercase ${
                isCanon 
                  ? 'bg-canon/10 text-canon border-canon/30' 
                  : 'bg-generated/10 text-generated border-generated/30 animate-pulse'
              }`}>
                {isCanon ? "CANON TIMELINE" : `BRANCH: ${branchId.substring(0, 8)}`}
              </span>
            </div>

            <div className="text-xs font-mono text-primary-muted flex items-center gap-4 mt-0.5">
              <span>Seq: <strong className="text-primary">{currentSequence}</strong> / {worldSummary.current_sequence}</span>
              <span>•</span>
              <span>Entities: <strong className="text-primary">{worldSummary.character_count}</strong></span>
              <span>•</span>
              <span>Events: <strong className="text-primary">{worldSummary.event_count}</strong></span>
              <span>•</span>
              <span>Facts: <strong className="text-primary">{worldSummary.knowledge_count}</strong></span>
            </div>
          </div>
        </div>

        {/* Global Action Tools */}
        <div className="flex items-center gap-3">
          {/* Theme Button */}
          <button
            onClick={() => setShowThemeModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/20 bg-white/10 hover:bg-white/20 text-xs font-mono font-bold text-primary backdrop-blur-md transition-all shadow-sm"
            title="Theme Controls & Texture Packs"
          >
            <Palette size={14} className="text-canon" />
            <span>Theme</span>
            <span className="w-2.5 h-2.5 rounded-full border border-white/30" style={{ background: activeThemePack.gradientPreview }} />
          </button>

          <button
            onClick={() => setShowVisualizer(true)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-purple-500/40 bg-purple-500/20 text-purple-200 hover:bg-purple-500/30 font-mono text-xs font-semibold backdrop-blur-md transition-all shadow-md group cursor-pointer"
            title="Synthesize AI Visual for active timeline scenario"
          >
            <Sparkles size={14} className="text-purple-300 animate-pulse group-hover:rotate-12 transition-transform" />
            <span>Visualize Scenario</span>
          </button>


          <button
            onClick={handleReloadSummary}
            title="Refresh World State"
            className="p-1.5 text-primary-muted hover:text-primary border border-white/15 rounded-lg hover:bg-white/10 backdrop-blur-md transition-colors"
          >
            <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
          </button>

          {/* Tab Selector for Right Panel */}
          <div className="flex bg-black/40 border border-white/15 rounded-lg p-1 gap-1 backdrop-blur-md">
            <button
              onClick={() => setActiveTab("chat")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-mono transition-all ${
                activeTab === "chat"
                  ? "bg-white/20 text-white font-semibold border border-white/25 shadow-md backdrop-blur-md"
                  : "text-primary-muted hover:text-white hover:bg-white/10"
              }`}
            >
              <MessageSquare size={14} />
              Character Chat
            </button>
            <button
              onClick={() => setActiveTab("branch")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-mono transition-all ${
                activeTab === "branch"
                  ? "bg-purple-500/30 text-purple-200 border border-purple-400/40 font-semibold shadow-md backdrop-blur-md"
                  : "text-primary-muted hover:text-white hover:bg-white/10"
              }`}
            >
              <GitBranch size={14} />
              What-If Lab
            </button>
            <button
              onClick={() => setActiveTab("entities")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-mono transition-all ${
                activeTab === "entities"
                  ? "bg-teal-500/30 text-teal-200 border border-teal-400/40 font-semibold shadow-md backdrop-blur-md"
                  : "text-primary-muted hover:text-white hover:bg-white/10"
              }`}
            >
              <Users size={14} />
              Dossier
            </button>
          </div>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        
        {/* Left / Center Visualizer Column */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col border-r border-white/10 overflow-hidden bg-transparent">
          <TimelineViz />
        </div>
        
        {/* Right Active Tool Column */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col overflow-hidden bg-black/30 backdrop-blur-xl border-l border-white/10 shadow-2xl">
          {activeTab === "chat" && <CharacterPanel />}
          {activeTab === "branch" && <BranchLab />}
          {activeTab === "entities" && <CharacterPanel initialTab="dossier" />}
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
