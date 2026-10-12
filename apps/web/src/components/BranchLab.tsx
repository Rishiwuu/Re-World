"use client";

import { useState, useEffect } from "react";
import { api, BranchDiffResponse, BranchInfo } from "@/lib/api";
import { useAppContext } from "./AppProvider";
import { GitBranch, Loader2, Sparkles, ArrowRight, RotateCcw, AlertTriangle } from "lucide-react";
import BranchDiff from "./BranchDiff";

export default function BranchLab() {
  const { storyId, branchId, setBranchId, currentSequence, setCurrentSequence, setWorldSummary, isDarkMode } = useAppContext();
  
  const [change, setChange] = useState("");
  const [loading, setLoading] = useState(false);
  const [diffData, setDiffData] = useState<BranchDiffResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [branchAgain, setBranchAgain] = useState(false);

  const loadBranches = async () => {
    if (!storyId) return;
    try { setBranches(await api.listBranches(storyId)); } catch (err) { console.error(err); }
  };

  useEffect(() => { loadBranches(); }, [storyId, branchId]);

  useEffect(() => {
    if (branchId !== "canon") {
      api.getBranchDiff(branchId)
        .then(setDiffData)
        .catch(console.error);
    } else {
      setDiffData(null);
    }
  }, [branchId]);

  const handleSimulate = async (e?: React.FormEvent, presetChange?: string) => {
    if (e) e.preventDefault();
    const query = presetChange || change;
    if (!storyId || !query.trim() || loading) return;

    setErrorMsg("");
    setLoading(true);

    try {
      const res = await api.createBranch(storyId, currentSequence, query.trim(), branchId);
      const diff = await api.getBranchDiff(res.branch.id);
      
      setBranchId(res.branch.id);
      setDiffData(diff);
      setChange("");
      setBranchAgain(false);

      const summary = await api.getWorldSummary(storyId, res.branch.id);
      setWorldSummary(summary);
      setCurrentSequence(res.branch.divergence_sequence);
      await loadBranches();
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to simulate timeline branch. Ensure the narrative engine is operational.");
    } finally {
      setLoading(false);
    }
  };

  const handleReturnToCanon = async () => {
    if (!storyId) return;
    try {
      setBranchId("canon");
      setDiffData(null);
      const summary = await api.getWorldSummary(storyId, "canon");
      setWorldSummary(summary);
      setCurrentSequence(summary.current_sequence);
    } catch (err) {
      console.error(err);
    }
  };

  const selectTimeline = async (timelineId: string) => {
    if (!storyId) return;
    const summary = await api.getWorldSummary(storyId, timelineId);
    setBranchId(timelineId);
    setWorldSummary(summary);
    setCurrentSequence(summary.current_sequence);
  };

  const presetIdeas = [
    "A key character reveals the secret truth early.",
    "The crucial evidence is destroyed before discovery.",
    "The suspect evades capture and disappears.",
  ];

  const timelinePicker = branches.length > 0 && (
    <div className={`border-t p-3 transition-colors backdrop-blur-md ${
      isDarkMode ? 'border-white/10 bg-black/20' : 'border-slate-200/80 bg-white/40'
    }`}>
      <div className={`text-[10px] font-mono uppercase tracking-wider mb-2 font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Saved timelines</div>
      <div className="flex flex-wrap gap-1.5">
        <button 
          onClick={handleReturnToCanon} 
          className={`text-[10px] font-mono px-2.5 py-1 border rounded-lg transition-all backdrop-blur-md cursor-timeline ${
            branchId === "canon" 
              ? (isDarkMode ? "border-canon text-canon bg-canon/10 font-bold shadow-sm" : "border-amber-500 text-amber-900 bg-amber-100 font-bold shadow-sm")
              : (isDarkMode ? "border-white/15 text-slate-400 hover:text-white bg-white/5" : "border-slate-200 text-slate-700 bg-white/70 hover:bg-slate-100 shadow-sm")
          }`}
        >
          CANON
        </button>
        {branches.map(branch => (
          <button 
            key={branch.id} 
            onClick={() => selectTimeline(branch.id)} 
            className={`text-[10px] font-mono px-2.5 py-1 border rounded-lg transition-all backdrop-blur-md cursor-branch ${
              branch.id === branchId 
                ? (isDarkMode ? "border-generated text-generated bg-generated/15 font-bold shadow-sm" : "border-purple-500 text-purple-900 bg-purple-100 font-bold shadow-sm")
                : (isDarkMode ? "border-white/15 text-slate-400 hover:text-white bg-white/5" : "border-slate-200 text-slate-700 bg-white/70 hover:bg-slate-100 shadow-sm")
            }`} 
            title={branch.description}
          >
            SEQ {branch.divergence_sequence} · {branch.name.slice(0, 20)}
          </button>
        ))}
      </div>
    </div>
  );

  if (branchId !== "canon" && diffData && !branchAgain) {
    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-transparent">
        {/* Branch Header Banner */}
        <div className={`flex-none p-3.5 border-b flex items-center justify-between backdrop-blur-md ${
          isDarkMode ? 'border-white/10 bg-purple-500/10 text-white' : 'border-purple-200 bg-purple-50/80 text-purple-950'
        }`}>
          <div className="flex items-center gap-2">
            <GitBranch size={16} className={`${isDarkMode ? 'text-generated' : 'text-purple-700'} animate-pulse`} />
            <div>
              <div className={`font-mono text-xs font-bold uppercase ${isDarkMode ? 'text-generated' : 'text-purple-900'}`}>
                Divergent Branch Active
              </div>
              <div className={`text-[10px] font-mono ${isDarkMode ? 'text-slate-400' : 'text-purple-700'}`}>
                Diverged at Sequence {diffData.events_added[0]?.sequence ?? currentSequence}
              </div>
            </div>
          </div>

          <button 
            onClick={handleReturnToCanon}
            className={`flex items-center gap-1.5 text-xs font-mono border px-2.5 py-1.5 rounded-xl transition-colors backdrop-blur-md cursor-timeline ${
              isDarkMode 
                ? "border-generated/40 text-generated hover:bg-generated/20 bg-generated/10" 
                : "border-purple-300 text-purple-900 bg-purple-100 hover:bg-purple-200 font-semibold shadow-sm"
            }`}
          >
            <RotateCcw size={13} />
            RETURN TO CANON
          </button>
        </div>

        <button
          onClick={() => setBranchAgain(true)}
          className={`mx-4 mt-3 flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-mono font-bold transition-all shadow-sm backdrop-blur-md cursor-branch ${
            isDarkMode 
              ? "border-generated/40 bg-generated/15 text-generated hover:bg-generated/25" 
              : "border-purple-300 bg-purple-100/90 text-purple-900 hover:bg-purple-200"
          }`}
        >
          <GitBranch size={14} /> DIVERGE FROM THIS TIMELINE
        </button>

        <div className="flex-1 overflow-y-auto">
          <BranchDiff diff={diffData} />
        </div>
        {timelinePicker}
      </div>
    );
  }

  return (
    <div className={`flex-1 flex flex-col h-full overflow-y-auto p-4 space-y-4 bg-transparent ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
      
      {/* Introduction Card */}
      <div className={`border rounded-2xl p-3.5 space-y-1.5 backdrop-blur-md shadow-sm ${
        isDarkMode ? 'bg-white/[0.03] border-white/10' : 'bg-white/60 border-slate-200/80'
      }`}>
        <div className="flex items-center gap-2 font-serif font-bold text-sm">
          <GitBranch size={16} className="text-generated" />
          What-If Simulation Engine
        </div>
        <p className={`text-xs font-serif leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
          Inject an alternate premise at <strong>Sequence {currentSequence}</strong>. The framework creates an isolated child timeline and rewrites downstream events without modifying canon.
        </p>
      </div>

      {/* Divergence Form */}
      <form onSubmit={handleSimulate} className="space-y-3">
        <div className="space-y-1.5">
          <label className={`text-xs font-mono uppercase tracking-wider flex items-center justify-between ${
            isDarkMode ? 'text-slate-400' : 'text-slate-700 font-bold'
          }`}>
            <span>Hypothesis Statement</span>
            <span className="text-generated font-bold">Seq {currentSequence}</span>
          </label>
          <textarea
            value={change}
            onChange={e => setChange(e.target.value)}
            placeholder="e.g. What if Evelyn confessed everything to Detective Hale immediately during initial questioning?"
            rows={4}
            className={`w-full border rounded-xl p-3 text-xs sm:text-sm font-serif transition-colors resize-none leading-relaxed backdrop-blur-md ${
              isDarkMode 
                ? "bg-black/30 border-white/15 text-white placeholder:text-slate-500 focus:border-generated" 
                : "bg-white/80 border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-purple-600 shadow-sm"
            }`}
          />
        </div>

        {errorMsg && (
          <div className="p-2.5 bg-danger/10 border border-danger/30 text-danger rounded-xl text-xs font-serif flex items-center gap-2">
            <AlertTriangle size={14} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={!change.trim() || loading}
          className="w-full bg-purple-700 hover:bg-purple-800 text-white font-mono text-xs uppercase font-bold py-2.5 px-4 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2 transition-all shadow-md cursor-whatif"
        >
          {loading ? (
            <><Loader2 size={15} className="animate-spin" /> Simulating Ripple Consequences...</>
          ) : (
            <><Sparkles size={15} /> Diverge Timeline</>
          )}
        </button>
      </form>

      {/* Preset Ideas */}
      <div className="space-y-2">
        <div className={`text-[10px] font-mono uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-600 font-bold'}`}>
          Preset Divergence Ideas
        </div>
        <div className="space-y-2">
          {presetIdeas.map((idea, i) => (
            <button
              key={i}
              onClick={() => handleSimulate(undefined, idea)}
              disabled={loading}
              className={`w-full text-left p-2.5 border rounded-xl text-xs font-serif transition-all flex items-center justify-between group backdrop-blur-md cursor-whatif ${
                isDarkMode 
                  ? "bg-white/[0.03] border-white/10 text-white hover:border-generated hover:bg-generated/5" 
                  : "bg-white/70 border-slate-200/80 text-slate-800 hover:border-purple-400 hover:bg-purple-50 shadow-sm"
              }`}
            >
              <span>“{idea}”</span>
              <ArrowRight size={13} className="text-slate-400 group-hover:text-purple-600 transition-colors shrink-0 ml-2" />
            </button>
          ))}
        </div>
      </div>
      {timelinePicker}

    </div>
  );
}
