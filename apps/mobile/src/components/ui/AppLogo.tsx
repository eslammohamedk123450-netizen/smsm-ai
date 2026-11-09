import { Image, StyleSheet, View } from "react-native";
import { colors } from "../../theme/colors";

type Props = { size?: number; accessibilityLabel?: string };

export function AppLogo({ size = 76, accessibilityLabel = "أيقونة Suly" }: Props) {
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

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: "#000000",
    borderWidth: 1,
    borderColor: "#262626",
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    overflow: "hidden",
  },
});
