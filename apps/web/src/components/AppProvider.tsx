"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { WorldStateSummary } from '@/lib/api';
import { THEME_PACKS, ThemePack } from '@/lib/themes';

interface AppState {
  storyId: string | null;
  branchId: string;
  currentSequence: number;
  worldSummary: WorldStateSummary | null;
  selectedCharacterId: string | null;
  
  // Theme & Atmosphere State
  isDarkMode: boolean;
  activeThemePackId: string;
  activeTextureMesh: string;
  showThemeModal: boolean;
  activeThemePack: ThemePack;

  setStoryId: (id: string | null) => void;
  setBranchId: (id: string) => void;
  setCurrentSequence: (seq: number) => void;
  setWorldSummary: (summary: WorldStateSummary | null) => void;
  setSelectedCharacterId: (id: string | null) => void;

  toggleDarkMode: () => void;
  setActiveThemePackId: (id: string) => void;
  setActiveTextureMesh: (mesh: string) => void;
  setShowThemeModal: (show: boolean) => void;
}

const AppContext = createContext<AppState | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [storyId, setStoryId] = useState<string | null>(null);
  const [branchId, setBranchId] = useState<string>("canon");
  const [currentSequence, setCurrentSequence] = useState<number>(0);
  const [worldSummary, setWorldSummary] = useState<WorldStateSummary | null>(null);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);

  // Theme State
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [activeThemePackId, setActiveThemePackId] = useState<string>("cosmic-violet");
  const [activeTextureMesh, setActiveTextureMesh] = useState<string>("silk");
  const [showThemeModal, setShowThemeModal] = useState<boolean>(false);

  const activeThemePack = THEME_PACKS.find(p => p.id === activeThemePackId) || THEME_PACKS[0];

  // Sync mode changes to body class
  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (isDarkMode) {
        document.documentElement.classList.remove('light-mode');
        document.documentElement.classList.add('dark-mode');
        document.body.classList.remove('light-mode');
        document.body.classList.add('dark-mode');
      } else {
        document.documentElement.classList.remove('dark-mode');
        document.documentElement.classList.add('light-mode');
        document.body.classList.remove('dark-mode');
        document.body.classList.add('light-mode');
      }
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    const nextMode = !isDarkMode;
    setIsDarkMode(nextMode);
    // Switch to default theme pack of chosen mode if current pack doesn't match
    if (nextMode && activeThemePack.mode === 'light') {
      setActiveThemePackId("cosmic-violet");
    } else if (!nextMode && activeThemePack.mode === 'dark') {
      setActiveThemePackId("platinum-frost");
    }
  };

  const handleSelectThemePack = (id: string) => {
    setActiveThemePackId(id);
    const pack = THEME_PACKS.find(p => p.id === id);
    if (pack) {
      setIsDarkMode(pack.mode === 'dark');
    }
  };

  return (
    <AppContext.Provider value={{
      storyId, setStoryId,
      branchId, setBranchId,
      currentSequence, setCurrentSequence,
      worldSummary, setWorldSummary,
      selectedCharacterId, setSelectedCharacterId,
      
      isDarkMode,
      activeThemePackId,
      activeTextureMesh,
      showThemeModal,
      activeThemePack,

      toggleDarkMode,
      setActiveThemePackId: handleSelectThemePack,
      setActiveTextureMesh,
      setShowThemeModal,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
