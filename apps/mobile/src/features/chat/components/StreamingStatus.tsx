import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { PremiumText as Text } from "../../../components/ui/PremiumText";
import { colors } from "../../../theme/colors";

export interface StreamingStatusProps {
  isStreaming: boolean;
  onCancel?(): void;
  taskLabel?: string | null;
}

export function StreamingStatus({ isStreaming, onCancel, taskLabel }: StreamingStatusProps) {
  const dots = useRef([
    new Animated.Value(0.35),
    new Animated.Value(0.35),
    new Animated.Value(0.35),
  ]).current;

  useEffect(() => {
    if (!isStreaming) {
      dots.forEach((dot) => {
        dot.stopAnimation();
        dot.setValue(0.35);
      });
      return;
    }

    const animations = dots.map((dot, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 150),
          Animated.timing(dot, { toValue: 1, duration: 250, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.35, duration: 450, useNativeDriver: true }),
        ])
      )
    );

    animations.forEach((animation) => animation.start());
    return () => animations.forEach((animation) => animation.stop());
  }, [dots, isStreaming]);

  if (!isStreaming) return null;

  return (
    <View
      style={styles.row}
      accessibilityRole="progressbar"
      accessibilityLabel={taskLabel || "Suly يكتب ردًا"}
    >
      <View style={styles.bubble}>
        <View style={styles.header}>
          <View style={styles.brandMark}>
            <Text style={styles.brandMarkText}>S</Text>
          </View>
          <Text style={styles.brand}>Suly</Text>
        </View>
        <View style={styles.dots} accessibilityLabel="جاري كتابة الرد">
          {dots.map((opacity, index) => (
            <Animated.View key={index} style={[styles.dot, { opacity }]} />
          ))}
        </View>
      </View>
      {onCancel ? (
        <Pressable
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel="إيقاف الرد"
          style={styles.stop}
        >
          <Text style={styles.stopText}>إيقاف</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginHorizontal: 16,
    marginVertical: 6,
    gap: 8,
  },
  bubble: {
    minWidth: 112,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 16,
    backgroundColor: "#111111",
    borderWidth: 1,
    borderColor: "#262626",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 7,
  },
  brandMark: {
    width: 18,
    height: 18,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  brandMarkText: { color: "#07111A", fontSize: 11, fontWeight: "900" },
  brand: { color: colors.textPrimary, fontSize: 12, fontWeight: "700" },
  dots: { flexDirection: "row", alignItems: "center", gap: 5, paddingLeft: 2 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
  stop: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "#EF44441F",
    borderWidth: 1,
    borderColor: "#EF444433",
  },
  stopText: { color: colors.error, fontSize: 11, fontWeight: "700" },
});
