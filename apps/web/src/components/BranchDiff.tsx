"use client";

import { useEffect, useState } from "react";
import { api, BranchDiffResponse, ConsistencyResponse } from "@/lib/api";
import { Plus, Minus, Edit3, Activity } from "lucide-react";

export default function BranchDiff({ diff }: { diff: BranchDiffResponse }) {
  const [consistency, setConsistency] = useState<ConsistencyResponse | null>(null);

  useEffect(() => {
    // Run consistency check on mount
    api.checkConsistency(diff.branch_id).then(setConsistency).catch(console.error);
  }, [diff.branch_id]);

  return (
    <div className="p-4 flex flex-col gap-6">
      
      {/* Ripple Metrics */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="bg-white/[0.04] dark:bg-white/[0.03] border border-white/10 dark:border-white/10 backdrop-blur-md rounded-xl p-2.5 text-center shadow-sm">
          <div className="text-xl font-mono font-bold text-generated">{diff.ripple_depth}</div>
          <div className="text-[9px] font-mono text-primary-muted uppercase mt-0.5 tracking-wider">Ripple Depth</div>
        </div>
        <div className="bg-white/[0.04] dark:bg-white/[0.03] border border-white/10 dark:border-white/10 backdrop-blur-md rounded-xl p-2.5 text-center shadow-sm">
          <div className="text-xl font-mono font-bold text-primary">{diff.characters_affected.length}</div>
          <div className="text-[9px] font-mono text-primary-muted uppercase mt-0.5 tracking-wider">Entities Affected</div>
        </div>
        <div className="bg-white/[0.04] dark:bg-white/[0.03] border border-white/10 dark:border-white/10 backdrop-blur-md rounded-xl p-2.5 text-center shadow-sm">
          <div className="text-xl font-mono font-bold text-primary">{diff.relationships_changed}</div>
          <div className="text-[9px] font-mono text-primary-muted uppercase mt-0.5 tracking-wider">Relationships</div>
        </div>
      </div>

      {/* Consistency Status */}
      {consistency && (
        <div className={`border rounded-xl p-3 flex items-start gap-2.5 backdrop-blur-md shadow-sm ${
          consistency.valid 
            ? 'border-fandom/30 bg-fandom/5 text-fandom' 
            : 'border-danger/30 bg-danger/5 text-danger cursor-contradiction'
        }`}>
          <Activity size={16} className="mt-0.5 shrink-0" />
          <div>
            <div className="font-mono text-xs font-bold uppercase tracking-wider mb-1">
              Consistency: {consistency.valid ? 'Verified' : 'Contradictions Detected'}
            </div>
            <div className="text-xs font-serif leading-relaxed">{consistency.summary}</div>
            
            {!consistency.valid && consistency.issues.length > 0 && (
              <ul className="mt-2 text-xs font-mono space-y-1 cursor-contradiction">
                {consistency.issues.map((issue, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="opacity-50">[{issue.type}]</span>
                    {issue.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Changes List */}
      <div>
        <h3 className="font-mono text-[11px] uppercase tracking-widest text-primary-muted mb-3 border-b border-white/10 pb-2 font-bold">
          Structural Divergence ({diff.total_changes})
        </h3>
        
        <div className="space-y-3">
          
          {/* Added */}
          {diff.events_added.map(e => (
            <div key={e.event_id} className="border-l-2 border-generated pl-3 bg-white/[0.02] p-2.5 rounded-r-xl border-y border-r border-white/5 backdrop-blur-sm shadow-sm cursor-branch">
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-generated/20 text-generated p-0.5 rounded-md"><Plus size={11} /></span>
                <span className="font-mono text-[11px] font-bold text-generated uppercase">Seq {e.sequence} | Generated</span>
              </div>
              <div className="text-xs font-serif font-bold text-primary">{e.title}</div>
              <div className="text-xs text-primary-muted mt-1 leading-relaxed">{e.branch_description}</div>
            </div>
          ))}

          {/* Changed */}
          {diff.events_changed.map(e => (
            <div key={e.event_id} className="border-l-2 border-canon pl-3 bg-white/[0.02] p-2.5 rounded-r-xl border-y border-r border-white/5 backdrop-blur-sm shadow-sm cursor-branch">
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-canon/20 text-canon p-0.5 rounded-md"><Edit3 size={11} /></span>
                <span className="font-mono text-[11px] font-bold text-canon uppercase">Seq {e.sequence} | Altered Canon</span>
              </div>
              <div className="text-xs font-serif font-bold text-primary">{e.title}</div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="bg-black/20 dark:bg-black/40 p-2 rounded-lg text-xs line-through opacity-50 border border-white/5 cursor-contradiction">
                  {e.canon_description}
                </div>
                <div className="bg-canon/10 p-2 rounded-lg text-xs text-canon border border-canon/20 cursor-branch">
                  {e.branch_description}
                </div>
              </div>
            </div>
          ))}
          
          {/* Removed */}
          {diff.events_removed.map(e => (
            <div key={e.event_id} className="border-l-2 border-danger pl-3 opacity-60">
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-danger/20 text-danger p-0.5 rounded"><Minus size={12} /></span>
                <span className="font-mono text-xs text-danger uppercase">Seq {e.sequence} | Severed</span>
              </div>
              <div className="text-sm font-serif line-through">{e.title}</div>
            </div>
          ))}

          {diff.total_changes === 0 && (
            <div className="text-center text-primary-muted text-sm font-mono opacity-50 py-4">
              No structural differences detected.
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
