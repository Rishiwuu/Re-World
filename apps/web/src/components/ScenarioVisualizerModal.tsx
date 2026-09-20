"use client";

import React, { useState, useEffect } from "react";
import { useAppContext } from "./AppProvider";
import { api, TimelineEvent, BranchDiffResponse } from "@/lib/api";
import { Sparkles, X, Download, Copy, RefreshCw, Wand2, Image as ImageIcon, Check } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function ScenarioVisualizerModal({ isOpen, onClose }: Props) {
  const { storyId, branchId, currentSequence, worldSummary } = useAppContext();

  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<"flux" | "turbo" | "anime" | "3d">("flux");
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "1:1" | "9:16" | "4:3">("16:9");
  const [seed, setSeed] = useState<number>(() => Math.floor(Math.random() * 99999999));
  const [seedLocked, setSeedLocked] = useState(false);
  const [enhancePrompt, setEnhancePrompt] = useState(true);

  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [scenarioContext, setScenarioContext] = useState<{
    title: string;
    branchName: string;
    hypothesis: string;
    currentBeat: string;
  }>({ title: "", branchName: "", hypothesis: "", currentBeat: "" });

  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  // Auto-fetch current timeline scenario & branch hypothesis on open
  useEffect(() => {
    if (!isOpen || !storyId) return;

    const fetchScenarioContext = async () => {
      try {
        const title = worldSummary?.story_id ? worldSummary.story_id.replace(/_/g, " ").replace(/-/g, " ") : storyId;
        let branchName = branchId === "canon" ? "Canon Timeline" : "Divergent Branch";
        let hypothesis = "";
        let currentBeat = "";

        // Fetch timeline events for active branch
        const timelineRes = await api.getTimeline(storyId, branchId).catch(() => ({ events: [] }));
        const activeEvent = timelineRes.events.find((e: TimelineEvent) => e.sequence === currentSequence) || timelineRes.events[0];
        if (activeEvent) {
          currentBeat = `[Sequence ${activeEvent.sequence}] ${activeEvent.title}: ${activeEvent.description}`;
        }

        // If in an alternate What-If branch, fetch branch hypothesis premise
        if (branchId !== "canon") {
          const diff: BranchDiffResponse = await api.getBranchDiff(branchId).catch(() => ({
            branch_id: branchId,
            events_added: [],
            events_modified: [],
            events_removed: [],
            facts_added: [],
            facts_invalidated: []
          }));
          if (diff.events_added.length > 0) {
            hypothesis = diff.events_added[0].title || diff.events_added[0].description;
          }
          const branches = await api.listBranches(storyId).catch(() => []);
          const bMatch = branches.find(b => b.id === branchId);
          if (bMatch) {
            branchName = bMatch.name;
            if (bMatch.description) hypothesis = bMatch.description;
          }
        }

        // Clean up title: remove hashes like "66e952", trim and capitalize
        const cleanTitle = title.replace(/\s+[a-f0-9]{6,}$/i, "").trim();
        const cleanBeat = currentBeat.replace(/^\[Sequence \d+\]\s*/i, "").replace(/He tells Harry to fetch Severus Snape,\s*/i, "").trim();

        setScenarioContext({ title: cleanTitle, branchName, hypothesis, currentBeat });

        // Compose clean, vivid visual prompt without raw metadata tags
        let autoPrompt = `A dramatic cinematic scene from ${cleanTitle}.`;
        if (hypothesis) {
          autoPrompt += ` Scenario premise: ${hypothesis}.`;
        }
        if (cleanBeat) {
          autoPrompt += ` Scene action: ${cleanBeat}.`;
        }

        setPrompt(autoPrompt);
      } catch (err) {
        console.error("Failed to fetch scenario context:", err);
      }
    };

    fetchScenarioContext();
  }, [isOpen, storyId, branchId, currentSequence, worldSummary]);

  if (!isOpen) return null;

  const getDimensions = () => {
    switch (aspectRatio) {
      case "16:9": return { w: 1280, h: 720 };
      case "9:16": return { w: 720, h: 1280 };
      case "4:3":  return { w: 1024, h: 768 };
      default:     return { w: 1024, h: 1024 };
    }
  };

  const handleGenerate = () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setErrorMsg("");

    const currentSeed = seedLocked ? seed : Math.floor(Math.random() * 99999999);
    if (!seedLocked) setSeed(currentSeed);

    const { w, h } = getDimensions();

    const modelStyles: Record<string, string> = {
      flux: "cinematic masterpiece, hyper-detailed, dramatic lighting, 8k resolution, photorealistic",
      turbo: "sharp focus, vivid colors, dynamic cinematic composition",
      anime: "makoto shinkai style anime, cell shaded, high detail",
      "3d": "octane render, unreal engine 5 visual, subsurface scattering"
    };

    // Sanitize prompt text
    let sanitized = prompt.replace(/[\[\]"]/g, "").trim();
    if (enhancePrompt && modelStyles[model]) {
      sanitized += `, ${modelStyles[model]}`;
    }

    const encoded = encodeURIComponent(sanitized);
    let url = `https://image.pollinations.ai/prompt/${encoded}?width=${w}&height=${h}&seed=${currentSeed}&nologo=true`;
    if (model === "flux") url += "&model=flux";
    if (model === "turbo") url += "&model=turbo";

    setImageUrl(url);
  };

  const handleDownload = async () => {
    if (!imageUrl) return;
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      const bUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = bUrl;
      a.download = `reworld-scenario-seq${currentSequence}-${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(bUrl);
    } catch {
      window.open(imageUrl, "_blank");
    }
  };

  const copyLink = () => {
    if (!imageUrl) return;
    navigator.clipboard.writeText(imageUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const copyPromptText = () => {
    if (!prompt) return;
    navigator.clipboard.writeText(prompt);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-fade-in">
      <div className="relative max-w-5xl w-full bg-[#0c0814]/90 border border-white/15 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-white/10 bg-black/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-purple-600 via-pink-600 to-amber-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Sparkles size={18} className="text-white animate-pulse" />
            </div>
            <div>
              <h2 className="font-serif font-bold text-base text-white tracking-wide flex items-center gap-2">
                Scenario AI Visualizer
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase">
                  Pollinations FLUX
                </span>
              </h2>
              <p className="text-xs font-mono text-primary-muted">
                {scenarioContext.branchName} • Sequence {currentSequence}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-primary-muted hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-y-auto p-6 gap-6">
          
          {/* Left Column: Prompt & Controls */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            
            {/* Scenario Auto-Fetch Badge */}
            <div className="bg-purple-950/40 border border-purple-500/30 p-3.5 rounded-xl space-y-1.5 backdrop-blur-md">
              <div className="flex items-center justify-between text-[11px] font-mono text-purple-300 font-bold uppercase">
                <span className="flex items-center gap-1.5"><Wand2 size={13} /> Active Scenario Context</span>
                <span className="text-amber-400">Seq {currentSequence}</span>
              </div>
              {scenarioContext.hypothesis && (
                <p className="text-xs font-serif text-purple-200/90 leading-relaxed">
                  <strong>What-If Hypothesis:</strong> {scenarioContext.hypothesis}
                </p>
              )}
              {scenarioContext.currentBeat && (
                <p className="text-[11px] font-mono text-primary-muted truncate">
                  {scenarioContext.currentBeat}
                </p>
              )}
            </div>

            {/* Prompt Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-primary-muted uppercase tracking-wider flex items-center justify-between">
                <span>Scene Prompt</span>
                <span className="text-purple-400 text-[10px]">Auto-fetched scenario</span>
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                placeholder="Describe the scene vision..."
                className="w-full bg-black/40 border border-white/15 rounded-xl p-3 text-xs font-serif text-white focus:outline-none focus:border-purple-500 transition-colors resize-none leading-relaxed"
              />
            </div>

            {/* Model Profile Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-primary-muted uppercase tracking-wider">Model Profile</label>
              <div className="grid grid-cols-4 gap-2">
                {(["flux", "turbo", "anime", "3d"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setModel(m)}
                    className={`py-2 rounded-lg text-xs font-mono capitalize transition-all border ${
                      model === m
                        ? "bg-purple-600/30 border-purple-400 text-white font-bold shadow-md"
                        : "bg-white/5 border-white/10 text-primary-muted hover:text-white hover:bg-white/10"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Aspect Ratio Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-primary-muted uppercase tracking-wider">Aspect Ratio</label>
              <div className="grid grid-cols-4 gap-2">
                {(["16:9", "1:1", "9:16", "4:3"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setAspectRatio(r)}
                    className={`py-1.5 rounded-lg text-xs font-mono transition-all border ${
                      aspectRatio === r
                        ? "bg-purple-600/30 border-purple-400 text-white font-bold shadow-md"
                        : "bg-white/5 border-white/10 text-primary-muted hover:text-white hover:bg-white/10"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Extra Controls: Seed & Enhancement */}
            <div className="flex items-center justify-between bg-black/30 border border-white/10 p-3 rounded-xl">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-mono text-primary">
                <input
                  type="checkbox"
                  checked={enhancePrompt}
                  onChange={(e) => setEnhancePrompt(e.target.checked)}
                  className="accent-purple-500 rounded cursor-pointer"
                />
                <span>AI Quality Enhancer</span>
              </label>

              <button
                type="button"
                onClick={() => {
                  const s = Math.floor(Math.random() * 99999999);
                  setSeed(s);
                  setSeedLocked(true);
                }}
                className="text-[11px] font-mono text-purple-300 hover:underline flex items-center gap-1"
              >
                <RefreshCw size={11} /> New Seed
              </button>
            </div>

            {/* Render Button */}
            <button
              onClick={handleGenerate}
              disabled={loading || !prompt.trim()}
              className="w-full py-3 rounded-xl font-mono uppercase text-xs font-bold text-white bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 hover:opacity-90 disabled:opacity-50 transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <><RefreshCw className="animate-spin" size={15} /> Synthesizing Scene...</>
              ) : (
                <><Sparkles size={15} /> Render Scenario Image</>
              )}
            </button>
          </div>

          {/* Right Column: Viewport Stage */}
          <div className="lg:col-span-7 flex flex-col justify-between bg-black/40 border border-white/10 rounded-xl p-4 min-h-[380px] relative">
            
            {/* Viewport Display */}
            <div className="flex-1 flex items-center justify-center relative overflow-hidden rounded-lg min-h-[300px]">
              {loading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md z-10 gap-3">
                  <div className="w-10 h-10 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
                  <p className="text-xs font-mono text-purple-300 animate-pulse">Rendering neural visualization...</p>
                </div>
              )}

              {errorMsg && (
                <div className="text-center p-6 text-xs font-serif text-danger">
                  {errorMsg}
                </div>
              )}

              {imageUrl && (
                <img
                  src={imageUrl}
                  alt="Synthesized Scenario"
                  onLoad={() => setLoading(false)}
                  onError={() => {
                    setLoading(false);
                    if (imageUrl.includes("model=flux")) {
                      setImageUrl(imageUrl.replace("&model=flux", ""));
                    } else {
                      setErrorMsg("Image synthesis timed out. Click Render Scenario Image to retry.");
                    }
                  }}
                  className={`max-h-[360px] w-auto h-auto object-contain rounded-lg shadow-2xl border border-white/15 ${loading ? "opacity-0" : "opacity-100 transition-opacity duration-300"}`}
                />
              )}

              {!imageUrl && !loading && !errorMsg && (
                <div className="flex flex-col items-center justify-center text-center p-8 text-primary-muted">
                  <ImageIcon size={40} className="mb-3 opacity-40 text-purple-400" />
                  <h4 className="font-serif text-sm font-bold text-primary mb-1">Canvas Ready</h4>
                  <p className="text-xs font-serif max-w-xs text-primary-muted">
                    Click <strong>Render Scenario Image</strong> above to synthesize the visual representation of this timeline branch beat.
                  </p>
                </div>
              )}
            </div>

            {/* Action Buttons Bar */}
            {imageUrl && (
              <div className="mt-4 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={copyPromptText}
                    className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/15 hover:bg-white/10 text-xs font-mono text-primary flex items-center gap-1.5 transition-colors"
                  >
                    {copiedPrompt ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                    <span>{copiedPrompt ? "Copied Prompt" : "Copy Prompt"}</span>
                  </button>

                  <button
                    onClick={copyLink}
                    className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/15 hover:bg-white/10 text-xs font-mono text-primary flex items-center gap-1.5 transition-colors"
                  >
                    {copiedLink ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                    <span>{copiedLink ? "Copied Link" : "Copy Link"}</span>
                  </button>
                </div>

                <button
                  onClick={handleDownload}
                  className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-mono text-xs font-bold flex items-center gap-1.5 shadow-md transition-colors"
                >
                  <Download size={14} />
                  <span>Download High-Res</span>
                </button>
              </div>
            )}

          </div>

        </div>

      </div>
    </div>
  );
}
