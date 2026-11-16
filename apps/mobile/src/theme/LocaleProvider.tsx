import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { View } from "react-native";
import { useSulyTheme } from "./ThemeProvider";

export type AppLanguage = "ar" | "en";

type AppLocaleContextValue = {
  language: AppLanguage;
  isArabic: boolean;
  direction: "rtl" | "ltr";
  setLanguage: (language: AppLanguage) => Promise<void>;
};

const AppLocaleContext = createContext<AppLocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>("ar");
  const [ready, setReady] = useState(false);
  const { colors } = useSulyTheme();
  const userChangedLanguage = useRef(false);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem("suly:language")
      .then((value) => {
        if (active && !userChangedLanguage.current && (value === "ar" || value === "en")) setLanguageState(value);
      })
      .catch(() => undefined)
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);

  const setLanguage = useCallback(async (next: AppLanguage) => {
    userChangedLanguage.current = true;
    setLanguageState(next);
    try { await AsyncStorage.setItem("suly:language", next); } catch { /* Keep the in-memory choice for this session. */ }
  }, []);

  const value = useMemo<AppLocaleContextValue>(() => ({
    language,
    isArabic: language === "ar",
    direction: language === "ar" ? "rtl" : "ltr",
    setLanguage,
  }), [language, setLanguage]);

  return (
    <AppLocaleContext.Provider value={value}>
      {ready ? children : <View style={{ flex: 1, backgroundColor: colors.background }} />}
    </AppLocaleContext.Provider>
  );
}

export function useAppLocale() {
  const context = useContext(AppLocaleContext);
  if (!context) throw new Error("useAppLocale must be used within LocaleProvider");
  return context;
}
