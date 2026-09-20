"use client";

import { useEffect, useState, useRef } from "react";
import { api, Character } from "@/lib/api";
import { useAppContext } from "./AppProvider";
import { Send, Loader2, ArrowLeft, ShieldAlert, BookOpen, Brain, MapPin, Target, Heart } from "lucide-react";

interface CharacterPanelProps {
  initialTab?: "chat" | "dossier";
}

export default function CharacterPanel({ initialTab = "chat" }: CharacterPanelProps) {
  const { 
    storyId, 
    branchId, 
    currentSequence, 
    selectedCharacterId, 
    setSelectedCharacterId, 
    setStoryId, 
    setBranchId, 
    setWorldSummary,
    isDarkMode,
  } = useAppContext();
  
  const [characters, setCharacters] = useState<Character[]>([]);
  const [character, setCharacter] = useState<Character | null>(null);
  const [panelTab, setPanelTab] = useState<"chat" | "dossier">(initialTab);
  
  type ChatMessage = { role: "user" | "character"; content: string; time?: string };
  const [chatLog, setChatLog] = useState<ChatMessage[]>([]);
  const [conversations, setConversations] = useState<Record<string, ChatMessage[]>>({});
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [factsList, setFactsList] = useState<{ id: string; statement: string; valid_from_sequence: number }[]>([]);
  const [showFacts, setShowFacts] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const conversationKey = `${branchId}:${currentSequence}:${selectedCharacterId || "none"}`;

  useEffect(() => {
    setChatLog(conversations[conversationKey] || []);
  }, [conversationKey, conversations]);

  useEffect(() => {
    setPanelTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (storyId) {
      api.getCharacters(storyId, branchId).then(data => {
        setCharacters(data || []);
        if (!selectedCharacterId && data && data.length > 0) {
          setSelectedCharacterId(data[0].id);
        }
      }).catch(console.error);
    }
  }, [storyId, branchId]);

  useEffect(() => {
    if (storyId && selectedCharacterId) {
      api.getCharacter(storyId, selectedCharacterId, branchId).then(setCharacter).catch(console.error);
      
      api.getCharacterKnowledge(storyId, selectedCharacterId, currentSequence, branchId)
        .then(res => {
          setFactsList((res.facts as { id: string; statement: string; valid_from_sequence: number }[]) || []);
        })
        .catch(() => setFactsList([]));
    }
  }, [storyId, selectedCharacterId, branchId, currentSequence]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatLog, loading]);

  const handleChat = async (e?: React.FormEvent, customMsg?: string) => {
    if (e) e.preventDefault();
    const query = customMsg || input;
    if (!query.trim() || !storyId || !selectedCharacterId || loading) return;

    const userMsg = query.trim();
    setInput("");
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const appendMessage = (message: ChatMessage) => {
      setChatLog(previous => {
        const next = [...previous, message];
        setConversations(all => ({ ...all, [conversationKey]: next }));
        return next;
      });
    };
    appendMessage({ role: "user", content: userMsg, time: now });
    setLoading(true);

    try {
      const res = await api.chatWithCharacter(storyId, selectedCharacterId, currentSequence, userMsg, branchId, chatLog.slice(-12));
      appendMessage({ role: "character", content: res.output, time: now });
    } catch {
      appendMessage({ role: "character", content: "Error: Unable to synthesize response from character persona at this sequence.", time: now });
    } finally {
      setLoading(false);
    }
  };

  const handleLoadDemoWorld = async () => {
    try {
      const summary = await api.getWorldSummary("demo", "canon");
      setStoryId("demo");
      setBranchId("canon");
      setWorldSummary(summary);
      setSelectedCharacterId("detective_hale");
    } catch (err) {
      console.error("Failed to load demo world", err);
    }
  };

  if (characters.length === 0) {
    return (
      <div className={`flex-1 flex flex-col items-center justify-center p-6 text-center ${isDarkMode ? 'bg-panel/40' : 'bg-slate-50 text-slate-900'}`}>
        <ShieldAlert size={36} className="text-canon mb-3 opacity-80" />
        <h3 className="font-serif text-lg font-bold mb-1">No Characters Registered</h3>
        <p className={`text-xs font-serif max-w-xs mb-6 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
          This story world has no extracted entities yet. You can explore the rich interactive pre-seeded murder mystery world.
        </p>
        <button
          onClick={handleLoadDemoWorld}
          className="bg-canon text-black text-xs font-mono font-bold uppercase px-4 py-2 rounded hover:bg-yellow-400 transition-colors shadow-md"
        >
          Load Ashwood Demo World
        </button>
      </div>
    );
  }

  if (!selectedCharacterId || !character) {
    return (
      <div className={`flex-1 flex flex-col overflow-hidden p-5 ${isDarkMode ? 'bg-panel/30 text-white' : 'bg-white text-slate-900'}`}>
        <div className={`flex items-center justify-between mb-4 border-b pb-3 ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
          <div>
            <h3 className="font-serif text-base font-bold">Dossier Registry</h3>
            <p className={`text-[11px] font-mono ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Select an entity to interrogate or inspect</p>
          </div>
          <span className={`text-xs font-mono px-2 py-1 rounded border ${isDarkMode ? 'bg-white/5 border-white/10 text-slate-300' : 'bg-slate-100 border-slate-300 text-slate-700'}`}>
            {characters.length} Subjects
          </span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {characters.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedCharacterId(c.id)}
              className={`w-full text-left p-3.5 border rounded-lg transition-all group shadow-sm flex flex-col gap-1.5 ${
                isDarkMode 
                  ? "bg-black/20 border-white/10 hover:border-canon/60 hover:bg-canon/5 text-white" 
                  : "bg-slate-50 border-slate-200 hover:border-amber-500 hover:bg-amber-50/60 text-slate-900"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-serif font-bold text-sm group-hover:text-canon transition-colors">
                  {c.name}
                </span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase ${
                  c.alive ? 'bg-canon/10 text-canon border-canon/30' : 'bg-danger/10 text-danger border-danger/30'
                }`}>
                  {c.alive ? "Active" : "Deceased"}
                </span>
              </div>
              <p className={`text-xs font-serif line-clamp-2 leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                {c.description || "Key story entity participating in the narrative timeline."}
              </p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const suggestions = [
    `What is your objective right now?`,
    `What did you observe up to sequence ${currentSequence}?`,
    `Who do you trust in this situation?`,
  ];

  return (
    <div className={`flex-1 flex flex-col h-full overflow-hidden ${isDarkMode ? 'bg-panel/30 text-white' : 'bg-white text-slate-900'}`}>
      
      {/* Subject Header */}
      <div className={`flex-none px-4 py-3 border-b flex items-center justify-between ${
        isDarkMode ? 'border-white/10 bg-black/20 text-white' : 'border-slate-200 bg-slate-50 text-slate-900'
      }`}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedCharacterId(null)}
            className={`p-1 rounded transition-colors ${isDarkMode ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'}`}
            title="Back to subject list"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-serif font-bold text-sm">{character.name}</h3>
              <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded border uppercase ${
                character.alive ? 'text-canon border-canon/30 bg-canon/5' : 'text-danger border-danger/30 bg-danger/5'
              }`}>
                {character.alive ? "Alive" : "Deceased"}
              </span>
            </div>
            {character.current_location && (
              <div className={`text-[10px] font-mono flex items-center gap-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                <MapPin size={10} /> {character.current_location}
              </div>
            )}
          </div>
        </div>

        {/* View Toggle & Facts Count */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFacts(!showFacts)}
            className={`text-[10px] font-mono border px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all ${
              showFacts
                ? (isDarkMode ? "bg-amber-500/25 text-amber-300 border-amber-400/50 font-bold" : "bg-amber-100 text-amber-900 border-amber-400 font-bold")
                : (isDarkMode ? "border-amber-400/30 text-amber-300/90 hover:bg-amber-500/15" : "border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100")
            }`}
          >
            <Brain size={12} />
            {factsList.length} Memory Facts
          </button>
        </div>
      </div>

      {/* Quick Character Chat Switcher Bar */}
      {characters.length > 1 && (
        <div className={`flex-none px-4 py-2 border-b flex items-center gap-2 overflow-x-auto ${
          isDarkMode ? 'border-white/10 bg-black/20' : 'border-slate-200 bg-slate-100/70'
        }`}>
          <span className={`text-[10px] font-mono shrink-0 uppercase tracking-wider font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Switch Character:</span>
          {characters.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedCharacterId(c.id)}
              className={`text-[11px] font-mono px-2.5 py-1 rounded-full shrink-0 transition-all ${
                c.id === character.id
                  ? (isDarkMode ? "bg-amber-500/25 text-amber-300 border border-amber-400/50 font-bold" : "bg-amber-600 text-white font-bold shadow-sm")
                  : (isDarkMode ? "bg-white/5 text-slate-400 border border-white/10 hover:text-white" : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-200")
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {/* Expandable Memory Facts Drawer */}
      {showFacts && (
        <div className={`flex-none p-3 border-b max-h-44 overflow-y-auto text-xs font-serif ${
          isDarkMode ? 'bg-black/40 border-white/10 text-white' : 'bg-amber-50/50 border-amber-200 text-slate-900'
        }`}>
          <div className="flex items-center justify-between text-[11px] font-mono mb-2 font-bold uppercase">
            <span className={isDarkMode ? 'text-slate-400' : 'text-slate-700'}>Knowledge Horizon (Seq ≤ {currentSequence})</span>
            <span className="text-canon">{factsList.length} Facts Bound</span>
          </div>
          {factsList.length === 0 ? (
            <p className={`text-xs italic ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>No knowledge facts unlocked at sequence {currentSequence}.</p>
          ) : (
            <ul className="space-y-1.5">
              {factsList.map((f, i) => (
                <li key={i} className={`flex gap-2 text-xs leading-relaxed p-1.5 rounded border ${
                  isDarkMode ? 'bg-black/30 border-white/10 text-slate-200' : 'bg-white border-amber-200 text-slate-800 shadow-sm'
                }`}>
                  <span className="text-canon font-mono text-[10px] shrink-0">[S{f.valid_from_sequence}]</span>
                  <span>{f.statement}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Dossier Detail Mode */}
      {panelTab === "dossier" ? (
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs font-serif leading-relaxed">
          <div className={`p-3.5 rounded-lg border space-y-2 ${isDarkMode ? 'bg-black/20 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
            <h4 className="font-mono text-[11px] font-bold uppercase flex items-center gap-1.5">
              <BookOpen size={13} className="text-canon" /> Overview
            </h4>
            <p className={isDarkMode ? 'text-slate-300' : 'text-slate-700'}>{character.description || "No biography provided."}</p>
          </div>

          {character.personality && character.personality.length > 0 && (
            <div className={`p-3.5 rounded-lg border space-y-2 ${isDarkMode ? 'bg-black/20 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
              <h4 className="font-mono text-[11px] font-bold uppercase flex items-center gap-1.5">
                <Heart size={13} className="text-generated" /> Personality Matrix
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {character.personality.map((trait, i) => (
                  <span key={i} className={`px-2 py-0.5 rounded text-[11px] font-mono border ${
                    isDarkMode ? 'bg-generated/10 border-generated/30 text-generated' : 'bg-purple-100 border-purple-300 text-purple-800 font-medium'
                  }`}>
                    {trait}
                  </span>
                ))}
              </div>
            </div>
          )}

          {character.goals && character.goals.length > 0 && (
            <div className={`p-3.5 rounded-lg border space-y-2 ${isDarkMode ? 'bg-black/20 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
              <h4 className="font-mono text-[11px] font-bold uppercase flex items-center gap-1.5">
                <Target size={13} className="text-fandom" /> Core Motivations & Goals
              </h4>
              <ul className={`list-disc pl-4 space-y-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                {character.goals.map((g, i) => (
                  <li key={i}>{g}</li>
                ))}
              </ul>
            </div>
          )}

          <button
            onClick={() => setPanelTab("chat")}
            className="w-full bg-canon text-black font-mono font-bold uppercase text-xs py-2 rounded hover:bg-amber-400 transition-colors shadow-md"
          >
            Launch Interrogation Session
          </button>
        </div>
      ) : (
        /* Interactive Chat Mode */
        <div className="flex-1 flex flex-col overflow-hidden">
          
          {/* Chat Messages Log */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
            {chatLog.length === 0 && (
              <div className={`flex flex-col items-center justify-center text-center py-6 px-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                <Brain size={32} className="text-canon mb-2" />
                <h4 className={`font-serif font-bold text-sm mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Temporal Knowledge Interrogation</h4>
                <p className="font-serif text-xs max-w-xs leading-relaxed mb-4">
                  {character.name} will respond strictly using facts known at or before <strong>Sequence {currentSequence}</strong>.
                </p>

                {/* Prompt Suggestions */}
                <div className="w-full space-y-2">
                  <div className={`text-[10px] font-mono uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-600 font-bold'}`}>Suggested Queries</div>
                  {suggestions.map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleChat(undefined, q)}
                      className={`w-full text-left text-xs font-serif p-2.5 rounded-lg transition-all ${
                        isDarkMode 
                          ? "bg-black/30 border border-white/10 hover:border-canon/60 text-white hover:bg-canon/5" 
                          : "bg-white border border-slate-200 hover:border-amber-500 text-slate-800 hover:bg-amber-50 shadow-sm"
                      }`}
                    >
                      “{q}”
                    </button>
                  ))}
                </div>
              </div>
            )}

            {chatLog.map((msg, i) => (
              <div key={i} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                <div className={`flex items-center gap-1.5 mb-1 text-[10px] font-mono ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  <span>{msg.role === "user" ? "YOU" : character.name.toUpperCase()}</span>
                  {msg.time && <span>• {msg.time}</span>}
                </div>
                <div className={`px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-serif leading-relaxed max-w-[90%] shadow-md ${
                  msg.role === "user"
                    ? (isDarkMode ? "bg-amber-500/20 text-amber-100 border border-amber-400/40 rounded-tr-none" : "bg-amber-600 text-white font-medium rounded-tr-none shadow-sm")
                    : (isDarkMode ? "bg-black/40 border border-white/15 text-white rounded-tl-none" : "bg-slate-100 border border-slate-200 text-slate-900 rounded-tl-none shadow-sm")
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className={`flex items-center gap-2 font-mono text-xs py-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                <Loader2 className="animate-spin text-canon" size={14} />
                <span>Interrogating {character.name}...</span>
              </div>
            )}
          </div>

          {/* Chat Input Bar */}
          <form onSubmit={handleChat} className={`flex-none p-3 border-t flex gap-2 ${
            isDarkMode ? 'border-white/10 bg-black/20' : 'border-slate-200 bg-slate-50'
          }`}>
            <input 
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={`Interrogate ${character.name.split(' ')[0]} at sequence ${currentSequence}...`}
              disabled={loading}
              className={`flex-1 border rounded-lg px-3 py-2 text-xs sm:text-sm font-serif transition-colors disabled:opacity-50 ${
                isDarkMode 
                  ? "bg-black/40 border-white/15 text-white focus:border-canon" 
                  : "bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-amber-500 shadow-inner"
              }`}
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="bg-amber-500 hover:bg-amber-400 text-black px-3 py-2 rounded-lg font-mono text-xs font-bold uppercase disabled:opacity-40 transition-all flex items-center justify-center shrink-0 shadow-md"
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            </button>
          </form>

        </div>
      )}
    </div>
  );
}
