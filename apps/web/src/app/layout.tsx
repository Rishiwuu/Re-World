import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Newsreader } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { AnimatedBackdrop } from "@/components/AnimatedBackdrop";
import { NavbarHeader } from "@/components/NavbarHeader";

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
    <html lang="en">
      <body
        className={`${inter.variable} ${jetbrains.variable} ${newsreader.variable} antialiased min-h-screen flex flex-col text-foreground transition-colors duration-400`}
      >
        <Providers>
          <AnimatedBackdrop />
          <NavbarHeader />
          <main className="relative z-10 flex-1 flex flex-col overflow-hidden">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
