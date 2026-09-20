import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Newsreader } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { AnimatedBackdrop } from "@/components/AnimatedBackdrop";

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter",
});

const jetbrains = JetBrains_Mono({ 
  subsets: ["latin"],
  variable: "--font-jetbrains",
});

const newsreader = Newsreader({ 
  subsets: ["latin"],
  style: ['normal', 'italic'],
  variable: "--font-newsreader",
});

export const metadata: Metadata = {
  title: "Re:World | Narrative Instrument",
  description: "Multi-Agent Narrative Framework",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${jetbrains.variable} ${newsreader.variable} antialiased min-h-screen flex flex-col bg-[#090611] text-foreground`}
      >
        <AnimatedBackdrop />
        <header className="relative z-10 border-b border-white/10 bg-black/20 backdrop-blur-xl px-6 py-3.5 flex items-center justify-between shrink-0 shadow-lg">
          <div className="flex items-center gap-2.5">
            <div className="w-3 h-3 rounded-full bg-canon shadow-[0_0_12px_rgba(251,191,36,0.7)] animate-pulse"></div>
            <h1 className="font-mono text-xs tracking-widest uppercase font-bold text-primary">Re:World</h1>
          </div>
          <div className="flex gap-4 font-mono text-xs text-primary-muted uppercase tracking-wider">
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Status: Online</span>
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span> Canon: Secure</span>
          </div>
        </header>
        <main className="relative z-10 flex-1 flex flex-col overflow-hidden">
          <Providers>
            {children}
          </Providers>
        </main>
      </body>
    </html>
  );
}
