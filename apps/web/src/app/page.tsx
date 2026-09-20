"use client";

import { useEffect, useRef, useState } from "react";
import { api, API_BASE, Story } from "@/lib/api";
import { useAppContext } from "@/components/AppProvider";
import WorldDashboard from "@/components/WorldDashboard";
import { UploadCloud, FolderOpen, Loader2, Sparkles } from "lucide-react";

export default function Home() {
  const { storyId, setStoryId, setBranchId, setCurrentSequence, setWorldSummary, setSelectedCharacterId } = useAppContext();
  
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState("");
  const [rawTitle, setRawTitle] = useState("");
  const [showRawInput, setShowRawInput] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadStories();
  }, []);

  const loadStories = async () => {
    try {
      setLoading(true);
      const data = await api.getStories();
      setStories(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const selectStory = async (id: string) => {
    try {
      const summary = await api.getWorldSummary(id, "canon");
      setStoryId(id);
      setBranchId("canon");
      setCurrentSequence(summary.current_sequence);
      setWorldSummary(summary);
      setSelectedCharacterId(null);
    } catch (err) {
      console.error("Failed to load world summary", err);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    try {
      setErrorMessage("");
      setUploading(true);
      const res = await api.uploadStory(file, file.name.replace(/\.[^/.]+$/, ""));
      await loadStories();
      await selectStory(res.story_id);
    } catch (err) {
      console.error("Upload failed", err);
      setErrorMessage(err instanceof Error ? err.message : "Upload failed. Please try a readable TXT, PDF, or DOCX file.");
    } finally {
      setUploading(false);
    }
  };

  const handleRawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawText.trim() || !rawTitle.trim()) return;
    try {
      setErrorMessage("");
      setUploading(true);
      const res = await fetch(`${API_BASE}/stories/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: rawTitle.trim(),
          raw_text: rawText.trim(),
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.detail || "Creation failed");
      }
      const data = await res.json();
      await loadStories();
      await selectStory(data.story_id);
    } catch (err) {
      console.error("Story creation failed", err);
      setErrorMessage(err instanceof Error ? err.message : "Story creation failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  if (storyId) {
    return <WorldDashboard />;
  }

  return (
    <div className="flex-1 flex items-center justify-center p-6 sm:p-10 relative overflow-hidden bg-transparent">
      {/* Background cinematic aura */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] sm:w-[900px] h-[600px] sm:h-[900px] bg-canon/5 rounded-full blur-[140px] pointer-events-none" />
      
      <div className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-2 gap-8 z-10">
        
        {/* Upload & Ingestion Panel */}
        <div className="bg-black/35 backdrop-blur-xl border border-white/10 p-7 rounded-2xl flex flex-col justify-between shadow-2xl">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-canon shadow-inner">
                <UploadCloud size={24} />
              </div>
              <button
                onClick={() => setShowRawInput(!showRawInput)}
                className="text-xs font-mono text-primary-muted hover:text-canon transition-colors underline"
              >
                {showRawInput ? "Upload File" : "Paste Raw Text"}
              </button>
            </div>
            
            <h2 className="text-xl font-serif font-bold text-primary mb-1">Ingest Source Material</h2>
            <p className="text-primary-muted text-xs mb-6 font-mono">
              Extract characters, sequential plot events, facts & relationships automatically.
            </p>
          </div>

          {errorMessage && (
            <div role="alert" className="mb-4 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs font-serif text-danger">
              {errorMessage}
            </div>
          )}

          {!showRawInput ? (
            <form onSubmit={handleUpload} className="w-full flex flex-col gap-4">
              <input
                ref={fileInputRef}
                id="story-file"
                type="file"
                className="sr-only"
                onChange={e => {
                  setErrorMessage("");
                  setFile(e.target.files?.[0] || null);
                }}
                accept=".txt,.pdf,.docx,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-white/15 rounded-xl p-8 hover:border-canon/60 hover:bg-canon/5 transition-all text-center group bg-black/20"
              >
                <span className="block text-xs font-mono text-primary-muted group-hover:text-primary transition-colors">
                  {file ? file.name : "Choose a TXT, PDF, or DOCX file"}
                </span>
                <span className="mt-2 block text-[10px] font-mono text-primary-muted/70">
                  {file ? "File selected — begin reconstruction below" : "Your file stays on this local app"}
                </span>
              </button>
              <button 
                type="submit" 
                disabled={!file || uploading}
                className="bg-white/15 hover:bg-white/25 border border-white/25 text-white font-mono uppercase text-xs font-bold py-3 px-4 rounded-xl disabled:opacity-40 flex items-center justify-center gap-2 transition-all shadow-lg backdrop-blur-md"
              >
                {uploading ? (
                  <><Loader2 className="animate-spin" size={15} /> Reconstructing World...</>
                ) : (
                  "Begin Reconstruction"
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRawSubmit} className="w-full flex flex-col gap-3">
              <input
                type="text"
                value={rawTitle}
                onChange={e => setRawTitle(e.target.value)}
                placeholder="Story Title (e.g. Marineford War, Hamlet...)"
                className="bg-black/30 border border-white/15 rounded-lg p-2.5 text-xs font-serif text-primary focus:outline-none focus:border-canon transition-colors"
                required
              />
              <textarea
                value={rawText}
                onChange={e => setRawText(e.target.value)}
                placeholder="Paste story chapters or narrative prose here..."
                rows={5}
                className="bg-black/30 border border-white/15 rounded-lg p-2.5 text-xs font-serif text-primary focus:outline-none focus:border-canon transition-colors resize-none leading-relaxed"
                required
              />
              <button 
                type="submit" 
                disabled={!rawText.trim() || !rawTitle.trim() || uploading}
                className="bg-white/15 hover:bg-white/25 border border-white/25 text-white font-mono uppercase text-xs font-bold py-3 px-4 rounded-xl disabled:opacity-40 flex items-center justify-center gap-2 transition-all shadow-lg backdrop-blur-md"
              >
                {uploading ? (
                  <><Loader2 className="animate-spin" size={15} /> Reconstructing World...</>
                ) : (
                  "Synthesize World State"
                )}
              </button>
            </form>
          )}
        </div>

        {/* Existing Worlds Panel */}
        <div className="bg-black/35 backdrop-blur-xl border border-white/10 p-7 rounded-2xl flex flex-col justify-between shadow-2xl">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5 text-primary">
                <FolderOpen size={20} className="text-canon" />
                <h2 className="text-xl font-serif font-bold">Archived Worlds</h2>
              </div>
              <span className="text-xs font-mono bg-white/10 border border-white/10 px-2 py-1 rounded text-primary-muted">
                {stories.length} Available
              </span>
            </div>

            {/* Featured Demo World Quick Launch */}
            <button
              onClick={() => selectStory("demo")}
              className="w-full text-left p-3.5 mb-4 border border-canon/40 bg-canon/10 rounded-xl hover:bg-canon/20 transition-all flex items-center justify-between group shadow-sm backdrop-blur-md"
            >
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles size={14} className="text-canon animate-pulse" />
                  <h3 className="font-serif text-sm font-bold text-canon">Featured: Ashwood Murder Mystery</h3>
                </div>
                <p className="text-primary-muted text-xs font-serif mt-1">
                  6 Characters (Detective Hale, Evelyn, Dr. Lin...), 12 Plot Events, 28 Facts.
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-canon group-hover:translate-x-1 transition-transform">
                LAUNCH →
              </span>
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2.5 max-h-56">
            {loading ? (
              <div className="animate-pulse flex flex-col gap-2.5">
                {[1, 2].map(i => (
                  <div key={i} className="h-16 bg-white/5 rounded-lg" />
                ))}
              </div>
            ) : stories.filter(s => s.id !== "demo").length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-primary-muted font-mono text-xs text-center py-6">
                No other archived worlds found.<br/>Ingest a new source above.
              </div>
            ) : (
              stories.filter(s => s.id !== "demo").map(story => (
                <button
                  key={story.id}
                  onClick={() => selectStory(story.id)}
                  className="text-left p-3 border border-white/10 bg-black/20 rounded-lg hover:border-canon/60 hover:bg-canon/5 transition-all group backdrop-blur-md"
                >
                  <h3 className="font-serif text-sm font-bold text-primary group-hover:text-canon transition-colors">
                    {story.title}
                  </h3>
                  <p className="text-primary-muted text-xs font-mono mt-0.5">{story.description}</p>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
