"use client";

import { AppProvider } from "./AppProvider";
import ThemeModal from "./ThemeModal";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      {children}
      <ThemeModal />
    </AppProvider>
  );
}
