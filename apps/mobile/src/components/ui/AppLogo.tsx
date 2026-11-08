import { Image, StyleSheet, View } from "react-native";
import { colors } from "../../theme/colors";

type Props = { size?: number; accessibilityLabel?: string };

export function AppLogo({ size = 76, accessibilityLabel = "أيقونة Suly" }: Props) {
  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: 16 }]}>
      <Image
        source={require("../../../assets/icon.png")}
        style={{ width: size, height: size, borderRadius: 16 }}
        resizeMode="cover"
        accessibilityLabel={accessibilityLabel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: "transparent",
    borderWidth: 0,
    shadowColor: colors.primary,
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
});
