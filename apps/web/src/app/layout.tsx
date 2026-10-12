import type { Metadata } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono, Lora } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { AnimatedBackdrop } from "@/components/AnimatedBackdrop";
import { NavbarHeader } from "@/components/NavbarHeader";

const fontSans = Plus_Jakarta_Sans({ 
  subsets: ["latin"],
  variable: "--font-sans",
});

const jetbrains = JetBrains_Mono({ 
  subsets: ["latin"],
  variable: "--font-jetbrains",
});

const lora = Lora({ 
  subsets: ["latin"],
  style: ['normal', 'italic'],
  variable: "--font-serif",
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
        className={`${fontSans.variable} ${jetbrains.variable} ${lora.variable} antialiased min-h-screen flex flex-col text-foreground transition-colors duration-400`}
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
