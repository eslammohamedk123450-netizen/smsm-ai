import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSulyTheme } from "../../theme/ThemeProvider";
import type { ThemePalette } from "../../theme/colors";

type Props = { size?: number; accessibilityLabel?: string };

/** High-contrast geometric S mark; avoids the low-contrast raster logo. */
export function AppLogo({ size = 76, accessibilityLabel = "أيقونة SULY" }: Props) {
  const { colors } = useSulyTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const radius = Math.round(size * 0.24);
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={[styles.wrap, { width: size, height: size, borderRadius: radius }]}
    >
      <Text allowFontScaling={false} style={[styles.mark, { fontSize: size * 0.76, lineHeight: size * 0.86 }]}>S</Text>
      <View style={[styles.accent, { width: Math.max(5, size * 0.105), height: Math.max(5, size * 0.105), borderRadius: size * 0.03 }]} />
    </View>
  );
}

const createStyles = (colors: ThemePalette) => StyleSheet.create({
  wrap: {
    backgroundColor: "#080B14",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: "#FFFFFF",
    shadowOpacity: 0.24,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  mark: {
    color: "#FFFFFF",
    fontWeight: "900",
    letterSpacing: -3,
    textAlign: "center",
    includeFontPadding: false,
    marginLeft: -2,
  },
  accent: {
    position: "absolute",
    right: "18%",
    bottom: "17%",
    backgroundColor: "#D4AF37",
  },
});
