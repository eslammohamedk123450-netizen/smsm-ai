import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Animated, StyleSheet, View, useColorScheme } from "react-native";
import { PremiumText as Text } from "./PremiumText";
import { getThemeColors } from "../../theme/colors";

type ToastKind = "success" | "error" | "info";
type ToastValue = { show(message: string, kind?: ToastKind): void };
const ToastContext = createContext<ToastValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [item, setItem] = useState<{ message: string; kind: ToastKind; key: number } | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const palette = getThemeColors(useColorScheme() === "light" ? "light" : "dark");
  const show = useCallback((message: string, kind: ToastKind = "info") => {
    if (timer.current) clearTimeout(timer.current);
    setItem({ message, kind, key: Date.now() });
  }, []);
  const value = useMemo(() => ({ show }), [show]);
  useEffect(() => {
    if (!item) return;
    opacity.setValue(0);
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    timer.current = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 240, useNativeDriver: true }).start(() => setItem(null));
    }, 2500);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [item, opacity]);
  const glyph = item?.kind === "success" ? "✓" : item?.kind === "error" ? "!" : "i";
  const glyphColor = item?.kind === "success" ? palette.success : item?.kind === "error" ? palette.error : palette.primary;
  return (
    <ToastContext.Provider value={value}>
      {children}
      {item ? <Animated.View pointerEvents="none" style={[styles.toast, { opacity, backgroundColor: palette.surface, borderColor: palette.divider, shadowColor: palette.background }]}>
        <View style={[styles.badge, { borderColor: glyphColor }]}><Text style={[styles.glyph, { color: glyphColor }]}>{glyph}</Text></View>
        <Text style={[styles.message, { color: palette.textPrimary }]}>{item.message}</Text>
      </Animated.View> : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast must be used inside ToastProvider");
  return value;
}

const styles = StyleSheet.create({
  toast: { position: "absolute", top: 52, left: 18, right: 18, zIndex: 10000, minHeight: 52, borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, flexDirection: "row-reverse", alignItems: "center", gap: 11, shadowOpacity: 0.14, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 9 },
  badge: { width: 25, height: 25, borderWidth: 1.5, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  glyph: { fontSize: 14, fontWeight: "800" },
  message: { flex: 1, textAlign: "right", fontSize: 14, lineHeight: 20 },
});
