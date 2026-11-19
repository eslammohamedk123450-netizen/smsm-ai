import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { PremiumText as Text } from "../../../components/ui/PremiumText";
import { AppLogo } from "../../../components/ui/AppLogo";
import { useSulyTheme } from "../../../theme/ThemeProvider";
import { useAppLocale } from "../../../theme/LocaleProvider";
import type { ThemePalette } from "../../../theme/colors";
export interface StreamingStatusProps { isStreaming: boolean; onCancel?(): void; taskLabel?: string | null; }
export function StreamingStatus({ isStreaming, onCancel, taskLabel }: StreamingStatusProps) {
  const { colors } = useSulyTheme(); const { isArabic } = useAppLocale();
  const styles = useMemo(() => createStyles(colors), [colors]);
  if (!isStreaming) return null;
  return <View style={styles.row} accessibilityRole="progressbar" accessibilityLabel={taskLabel || (isArabic ? "SULY يجهّز الرد" : "SULY is preparing a response")}>
    <AppLogo size={28} isAnimating accessibilityLabel="شعار SULY المتحرك" />
    <View style={styles.copy}><Text style={styles.brand}>SULY</Text><Text style={styles.taskLabel}>{taskLabel || (isArabic ? "يجهّز إجابتك…" : "Preparing your answer…")}</Text></View>
    {onCancel ? <Pressable onPress={onCancel} accessibilityRole="button" accessibilityLabel={isArabic ? "إيقاف الرد" : "Stop response"} style={styles.stop}><Text style={styles.stopText}>{isArabic ? "إيقاف" : "Stop"}</Text></Pressable> : null}
  </View>;
}
const createStyles = (colors: ThemePalette) => StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", marginHorizontal: 18, marginVertical: 12, gap: 10, minHeight: 36 },
  copy: { gap: 1 }, brand: { color: colors.textPrimary, fontSize: 12, lineHeight: 16, fontWeight: "800", letterSpacing: 1.1 },
  taskLabel: { color: colors.textSecondary, fontSize: 11, lineHeight: 16 },
  stop: { marginLeft: 8, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: "transparent", borderWidth: 1, borderColor: colors.error },
  stopText: { color: colors.error, fontSize: 11, fontWeight: "700" }
});
