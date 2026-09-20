export interface ThemePack {
  id: string;
  name: string;
  mode: 'dark' | 'light';
  color1: string;
  color2: string;
  color3: string;
  bgHex: string;
  accentColor: string;
  gradientPreview: string;
  description: string;
}

export const THEME_PACKS: ThemePack[] = [
  {
    id: "cosmic-violet",
    name: "Cosmic Violet & Rose",
    mode: "dark",
    color1: "#3b0764",
    color2: "#180b2b",
    color3: "#f43f5e",
    bgHex: "#090611",
    accentColor: "#c084fc",
    gradientPreview: "linear-gradient(135deg, #3b0764 0%, #180b2b 50%, #f43f5e 100%)",
    description: "Deep violet wave plane with rich crimson streak glows.",
  },
  {
    id: "cyber-emerald",
    name: "Cyber Obsidian & Emerald",
    mode: "dark",
    color1: "#064e3b",
    color2: "#022c22",
    color3: "#2dd4bf",
    bgHex: "#021712",
    accentColor: "#2dd4bf",
    gradientPreview: "linear-gradient(135deg, #064e3b 0%, #022c22 50%, #2dd4bf 100%)",
    description: "Cyberpunk matrix obsidian with vibrant emerald green waves.",
  },
  {
    id: "solar-amber",
    name: "Solar Flare & Amber",
    mode: "dark",
    color1: "#7c2d12",
    color2: "#311005",
    color3: "#fbbf24",
    bgHex: "#140804",
    accentColor: "#fbbf24",
    gradientPreview: "linear-gradient(135deg, #7c2d12 0%, #311005 50%, #fbbf24 100%)",
    description: "Warm glowing amber gold lava gradient with mahogany depth.",
  },
  {
    id: "neon-aurora",
    name: "Neon Aurora & Cyan",
    mode: "dark",
    color1: "#831843",
    color2: "#0f172a",
    color3: "#38bdf8",
    bgHex: "#0a0f1d",
    accentColor: "#38bdf8",
    gradientPreview: "linear-gradient(135deg, #831843 0%, #0f172a 50%, #38bdf8 100%)",
    description: "Electric magenta waves combined with deep space aurora cyan.",
  },
  {
    id: "platinum-frost",
    name: "Celestial Platinum & Azure",
    mode: "light",
    color1: "#bae6fd",
    color2: "#f1f5f9",
    color3: "#0284c7",
    bgHex: "#f8fafc",
    accentColor: "#0284c7",
    gradientPreview: "linear-gradient(135deg, #bae6fd 0%, #f1f5f9 50%, #0284c7 100%)",
    description: "Luminous silver platinum with cool sky azure highlights.",
  },
  {
    id: "peach-quartz",
    name: "Sunset Quartz & Warm Gold",
    mode: "light",
    color1: "#fed7aa",
    color2: "#fff1f2",
    color3: "#f59e0b",
    bgHex: "#fffdfa",
    accentColor: "#d97706",
    gradientPreview: "linear-gradient(135deg, #fed7aa 0%, #fff1f2 50%, #f59e0b 100%)",
    description: "Warm peach rose quartz with glowing sunset amber accents.",
  },
];
