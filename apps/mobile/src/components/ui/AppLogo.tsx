import { Image, StyleSheet, View } from "react-native";
import { colors } from "../../theme/colors";

type Props = { size?: number; accessibilityLabel?: string };

export function AppLogo({ size = 48, accessibilityLabel = "أيقونة سولي" }: Props) {
  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: size * 0.27 }]}>
      <Image source={require("../../../assets/icon.png")} style={{ width: size, height: size, borderRadius: size * 0.27 }} resizeMode="cover" accessibilityLabel={accessibilityLabel} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.surface, shadowColor: colors.primary, shadowOpacity: 0.28, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 6 },
});
