import AsyncStorage from "@react-native-async-storage/async-storage";
import { Appearance, useColorScheme } from "react-native";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getThemeColors, type ThemePalette } from "./colors";

export type ThemeMode = "system" | "light" | "dark";
type ThemeContextValue = { mode: ThemeMode; effectiveMode: "light" | "dark"; colors: ThemePalette; setMode(mode: ThemeMode): Promise<void> };
const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = "suly:appearance";

export function SulyThemeProvider({ children }: { children: ReactNode }) {
  const systemMode = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (!active) return;
      if (stored === "light" || stored === "dark" || stored === "system") setModeState(stored);
    }).catch(() => undefined).finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!ready) return;
    Appearance.setColorScheme(mode === "system" ? null : mode);
    void AsyncStorage.setItem(STORAGE_KEY, mode).catch(() => undefined);
  }, [mode, ready]);

  const setMode = useCallback(async (next: ThemeMode) => { setModeState(next); }, []);
  const effectiveMode = mode === "system" ? (systemMode === "dark" ? "dark" : "light") : mode;
  const palette = useMemo(() => getThemeColors(effectiveMode), [effectiveMode]);
  const value = useMemo(() => ({ mode, effectiveMode, colors: palette, setMode }), [mode, effectiveMode, palette, setMode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useSulyTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useSulyTheme must be used inside SulyThemeProvider.");
  return value;
}
