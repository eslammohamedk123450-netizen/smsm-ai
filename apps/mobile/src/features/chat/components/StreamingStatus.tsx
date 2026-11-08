import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, View } from "react-native";
import { PremiumText as Text } from "../../../components/ui/PremiumText";
import { colors } from "../../../theme/colors";

export interface StreamingStatusProps {
  isStreaming: boolean;
  onCancel?(): void;
  taskLabel?: string | null;
}

export function StreamingStatus({ isStreaming, onCancel, taskLabel }: StreamingStatusProps) {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!isStreaming) {
      spin.stopAnimation();
      spin.setValue(0);
      return;
    }
    const animation = Animated.loop(Animated.timing(spin, {
      toValue: 1,
      duration: 1000,
      easing: Easing.linear,
      useNativeDriver: true,
    }));
    animation.start();
    return () => animation.stop();
  }, [isStreaming, spin]);

  if (!isStreaming) return null;
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  return (
    <View style={styles.container}>
      <Animated.View style={[styles.logo, { transform: [{ rotate }] }]}><Text style={styles.logoText}>S</Text></Animated.View>
      <Text style={styles.text}>{taskLabel || "جاري العمل…"}</Text>
      <Pressable onPress={onCancel} accessibilityRole="button" accessibilityLabel="إيقاف الرد" style={styles.stop}>
        <Text style={styles.cancel}>إيقاف</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "center", justifyContent: "flex-start", gap: 9, paddingVertical: 9, paddingHorizontal: 18 },
  logo: { width: 23, height: 23, borderRadius: 12, borderWidth: 2, borderColor: colors.accent, alignItems: "center", justifyContent: "center" },
  logoText: { color: colors.accent, fontWeight: "900", fontSize: 13 },
  text: { color: colors.textSecondary, fontSize: 13, fontWeight: "500" },
  stop: { marginLeft: "auto", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: "#EF44441A" },
  cancel: { color: colors.error, fontSize: 12, fontWeight: "700" },
});
