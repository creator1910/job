import { createContext, useContext, useState, useEffect } from "react";

export type Theme = "dark" | "light";

export interface Colors {
  bg: string;
  bgSurface: string;
  bgElevated: string;
  border: string;
  borderMuted: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  textDim: string;
  textFaint: string;
  accent: string;
  verdictColors: { BUY: string; HOLD: string; SELL: string; SHORT: string };
}

const DARK: Colors = {
  bg: "#0a0a0a",
  bgSurface: "#0d0d0d",
  bgElevated: "#111",
  border: "#1a1a1a",
  borderMuted: "#111",
  text: "#e8e8e8",
  textSecondary: "#999",
  textMuted: "#555",
  textDim: "#333",
  textFaint: "#1e1e1e",
  accent: "#ff2222",
  verdictColors: { BUY: "#00cc66", HOLD: "#cccc00", SELL: "#ff8800", SHORT: "#ff2222" },
};

const LIGHT: Colors = {
  bg: "#f5f5f0",
  bgSurface: "#ebebе6",
  bgElevated: "#e2e2dd",
  border: "#d4d4cf",
  borderMuted: "#e0e0db",
  text: "#111111",
  textSecondary: "#555",
  textMuted: "#888",
  textDim: "#bbb",
  textFaint: "#d8d8d3",
  accent: "#cc0000",
  verdictColors: { BUY: "#007a3d", HOLD: "#7a7000", SELL: "#cc5500", SHORT: "#cc0000" },
};

interface ThemeCtx {
  theme: Theme;
  colors: Colors;
  toggle: () => void;
}

const Ctx = createContext<ThemeCtx>({ theme: "dark", colors: DARK, toggle: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    try { return (localStorage.getItem("job-theme") as Theme) ?? "dark"; } catch { return "dark"; }
  });

  const colors = theme === "dark" ? DARK : LIGHT;

  const toggle = () => setTheme((t) => {
    const next = t === "dark" ? "light" : "dark";
    try { localStorage.setItem("job-theme", next); } catch {}
    return next;
  });

  useEffect(() => {
    document.body.style.backgroundColor = colors.bg;
  }, [colors.bg]);

  return <Ctx.Provider value={{ theme, colors, toggle }}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);
