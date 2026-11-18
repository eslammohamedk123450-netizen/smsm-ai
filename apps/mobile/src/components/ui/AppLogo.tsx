import React from "react";
import { Image, StyleSheet, View } from "react-native";
import { useSulyTheme } from "../../theme/ThemeProvider";
import type { ThemePalette } from "../../theme/colors";

type Props = { size?: number; accessibilityLabel?: string };

export function AppLogo({ size = 76, accessibilityLabel = "أيقونة Suly" }: Props) {
  const { colors } = useSulyTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const radius = Math.round(size * 0.22);
  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: radius }]}>
      <Image
        source={require("../../../assets/suly-icon.png")}
        style={{ width: size, height: size, borderRadius: radius }}
        resizeMode="cover"
        accessibilityLabel={accessibilityLabel}
      />
    </View>
  );
}

const createStyles = (colors: ThemePalette) => StyleSheet.create({
  wrap: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.divider,
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    overflow: "hidden",
  },
});
