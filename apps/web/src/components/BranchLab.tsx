"use client";

import { useState, useEffect } from "react";
import { api, BranchDiffResponse, BranchInfo } from "@/lib/api";
import { useAppContext } from "./AppProvider";
import { GitBranch, Loader2, Sparkles, ArrowRight, RotateCcw, AlertTriangle } from "lucide-react";
import BranchDiff from "./BranchDiff";

export default function BranchLab() {
  const { storyId, branchId, setBranchId, currentSequence, setCurrentSequence, setWorldSummary } = useAppContext();
  
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

  // When branchId changes or on mount, fetch diff if on a branch
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
      // 1. Create branch at divergence sequence
      const res = await api.createBranch(storyId, currentSequence, query.trim(), branchId);
      
      // 2. Fetch diff
      const diff = await api.getBranchDiff(res.branch.id);
      
      // 3. Update active branch & world summary
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
    <div className="border-t border-white/10 p-3 bg-black/20 backdrop-blur-md">
      <div className="text-[10px] font-mono uppercase tracking-wider text-primary-muted mb-2">Saved timelines</div>
      <div className="flex flex-wrap gap-2">
        <button onClick={handleReturnToCanon} className={`text-[10px] font-mono px-2 py-1 border rounded ${branchId === "canon" ? "border-canon text-canon bg-canon/10" : "border-white/15 text-primary-muted"}`}>CANON</button>
        {branches.map(branch => <button key={branch.id} onClick={() => selectTimeline(branch.id)} className={`text-[10px] font-mono px-2 py-1 border rounded ${branch.id === branchId ? "border-generated text-generated bg-generated/10" : "border-white/15 text-primary-muted"}`} title={branch.description}>SEQ {branch.divergence_sequence} · {branch.name.slice(0, 20)}</button>)}
      </div>
    </div>
  );

  if (branchId !== "canon" && diffData && !branchAgain) {
    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-transparent">
        {/* Branch Header Banner */}
        <div className="flex-none p-3.5 border-b border-panel-border bg-generated/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitBranch size={16} className="text-generated animate-pulse" />
            <div>
              <div className="font-mono text-xs font-bold text-generated uppercase">
                Divergent Branch Active
              </div>
              <div className="text-[10px] font-mono text-primary-muted">
                Diverged at Sequence {diffData.events_added[0]?.sequence ?? currentSequence}
              </div>
            </div>
          </div>

          <button 
            onClick={handleReturnToCanon}
            className="flex items-center gap-1.5 text-xs font-mono border border-generated/40 text-generated hover:bg-generated/20 px-2.5 py-1.5 rounded transition-colors"
          >
            <RotateCcw size={13} />
            RETURN TO CANON
          </button>
        </div>

        <button
          onClick={() => setBranchAgain(true)}
          className="mx-4 mt-3 flex items-center justify-center gap-2 rounded border border-generated/40 bg-generated/10 px-3 py-2 text-xs font-mono text-generated hover:bg-generated/20"
        >
          <GitBranch size={14} /> DIVERGE FROM THIS TIMELINE
        </button>

        {/* Structural Diff Output */}
        <div className="flex-1 overflow-y-auto">
          <BranchDiff diff={diffData} />
        </div>
        {timelinePicker}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto p-5 bg-transparent space-y-5">
      
      {/* Introduction Card */}
      <div className="bg-black/35 backdrop-blur-xl border border-white/10 rounded-xl p-4 space-y-2 shadow-lg">
        <div className="flex items-center gap-2 text-primary font-serif font-bold text-base">
          <GitBranch size={18} className="text-generated" />
          What-If Simulation Engine
        </div>
        <p className="text-xs font-serif text-primary-muted leading-relaxed">
          Inject an alternate premise at <strong>Sequence {currentSequence}</strong>. The framework creates an isolated child timeline and rewrites the downstream story without modifying its parent.
        </p>
      </div>

      {/* Divergence Form */}
      <form onSubmit={handleSimulate} className="space-y-3">
        <div className="space-y-1.5">
          <label className="text-xs font-mono text-primary-muted uppercase tracking-wider flex items-center justify-between">
            <span>Hypothesis Statement</span>
            <span className="text-generated font-bold">Divergence Point: Seq {currentSequence}</span>
          </label>
          <textarea
            value={change}
            onChange={e => setChange(e.target.value)}
            placeholder="e.g. What if Evelyn confessed everything to Detective Hale immediately during the initial questioning?"
            rows={4}
            className="w-full bg-background border border-border rounded-lg p-3 text-xs sm:text-sm font-serif text-primary focus:outline-none focus:border-generated transition-colors resize-none leading-relaxed"
          />
        </div>

        {errorMsg && (
          <div className="p-2.5 bg-danger/10 border border-danger/30 text-danger rounded text-xs font-serif flex items-center gap-2">
            <AlertTriangle size={14} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={!change.trim() || loading}
          className="w-full bg-generated text-white font-mono text-xs uppercase font-bold py-2.5 px-4 rounded-lg hover:bg-violet-600 disabled:opacity-50 flex items-center justify-center gap-2 transition-all shadow-md"
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
        <div className="text-[10px] font-mono uppercase tracking-wider text-primary-muted">
          Preset Divergence Ideas
        </div>
        <div className="space-y-2">
          {presetIdeas.map((idea, i) => (
            <button
              key={i}
              onClick={() => handleSimulate(undefined, idea)}
              disabled={loading}
              className="w-full text-left p-2.5 bg-background border border-border rounded-lg text-xs font-serif text-primary hover:border-generated hover:bg-generated/5 transition-all flex items-center justify-between group"
            >
              <span>“{idea}”</span>
              <ArrowRight size={13} className="text-primary-muted group-hover:text-generated transition-colors shrink-0 ml-2" />
            </button>
          ))}
        </div>
      </div>
      {timelinePicker}

    </div>
  );
}
