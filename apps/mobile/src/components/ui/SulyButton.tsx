import { ActivityIndicator, Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import { PremiumText as Text } from "./PremiumText";
import { useSulyTheme } from "../../theme/ThemeProvider";
type Props = Omit<PressableProps, "children" | "style"> & { label: string; variant?: "primary" | "secondary" | "ghost"; loading?: boolean; style?: StyleProp<ViewStyle> };
export function SulyButton({ label, variant = "primary", loading = false, disabled, style, ...props }: Props) {
  const { colors } = useSulyTheme();
  const primary = variant === "primary";
  const secondary = variant === "secondary";
  return <Pressable {...props} accessibilityRole="button" disabled={disabled || loading} style={[styles.base, { backgroundColor: primary ? colors.primary : secondary ? colors.surfaceElevated : "transparent", borderColor: primary ? colors.primary : colors.divider }, !primary && styles.outlined, (disabled || loading) && styles.disabled, style]}>
    {loading ? <ActivityIndicator size="small" color={primary ? colors.onPrimary : colors.textPrimary} /> : <Text style={[styles.label, { color: primary ? colors.onPrimary : colors.textPrimary }]}>{label}</Text>}
  </Pressable>;
}
const styles = StyleSheet.create({ base: { minHeight: 46, paddingHorizontal: 18, borderRadius: 12, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }, outlined: { borderWidth: 1 }, label: { fontSize: 14, fontWeight: "700" }, disabled: { opacity: 0.45 } });
