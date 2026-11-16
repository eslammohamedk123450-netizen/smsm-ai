import { Pressable, StyleSheet } from "react-native";
import { PremiumText as Text } from "./PremiumText";
import { useSulyTheme } from "../../theme/ThemeProvider";

type Props = { icon: string; label: string; onPress(): void; disabled?: boolean; accent?: boolean };
export function IconButton({ icon, label, onPress, disabled = false, accent = false }: Props) {
  const { colors: palette } = useSulyTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.button, { backgroundColor: accent ? palette.primary : palette.surface, borderColor: accent ? palette.primary : palette.divider, opacity: disabled ? 0.45 : pressed ? 0.78 : 1 }]}
    >
      <Text style={[styles.icon, { color: accent ? palette.background : palette.textPrimary }]}>{icon}</Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({ button: { width: 42, height: 42, borderWidth: 1, borderRadius: 21, alignItems: "center", justifyContent: "center" }, icon: { fontSize: 21, fontWeight: "500" } });
