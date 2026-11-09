import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, View } from "react-native";
import { PremiumText as Text } from "../../../components/ui/PremiumText";
import { AppLogo } from "../../../components/ui/AppLogo";
import { colors } from "../../../theme/colors";

export interface StreamingStatusProps {
  isStreaming: boolean;
  onCancel?(): void;
  taskLabel?: string | null;
}

export function StreamingStatus({ isStreaming, onCancel, taskLabel }: StreamingStatusProps) {
  const spin = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    if (!isStreaming) {
      spin.stopAnimation();
      spin.setValue(0);
      pulse.stopAnimation();
      pulse.setValue(0.5);
      return;
    }

    const spinAnim = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    const pulseAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 600, useNativeDriver: true }),
      ])
    );

    spinAnim.start();
    pulseAnim.start();

    return () => {
      spinAnim.stop();
      pulseAnim.stop();
    };
  }, [isStreaming, spin, pulse]);

  if (!isStreaming) return null;

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <View style={styles.card}>
      <View style={styles.leftGroup}>
        {/* Rotating Blue Luminous Ring surrounding Suly Logo */}
        <View style={styles.logoWrap}>
          <Animated.View style={[styles.orbitalRing, { transform: [{ rotate }] }]} />
          <View style={styles.appLogoContainer}>
            <AppLogo size={24} accessibilityLabel="أيقونة Suly" />
          </View>
        </View>

        <View style={styles.textColumn}>
          <View style={styles.titleRow}>
            <Text style={styles.brandTitle}>Suly</Text>
            <Animated.Text style={[styles.thinkingLabel, { opacity: pulse }]}>
              يفكر الآن…
            </Animated.Text>
          </View>
          <Text style={styles.subtext}>{taskLabel || "جاري معالجة الطلب وصياغة أفضل رد"}</Text>
        </View>
      </View>

      {onCancel ? (
        <Pressable onPress={onCancel} accessibilityRole="button" accessibilityLabel="إيقاف الرد" style={styles.stop}>
          <Text style={styles.cancel}>إيقاف</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderColor: colors.divider,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    gap: 12,
  },
  leftGroup: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  logoWrap: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  orbitalRing: {
    position: "absolute",
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: "transparent",
    borderTopColor: colors.primary,
    borderRightColor: "#38BDF8",
  },
  appLogoContainer: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  textColumn: {
    alignItems: "flex-end",
    flex: 1,
  },
  titleRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
  },
  brandTitle: {
    color: colors.textPrimary,
    fontWeight: "800",
    fontSize: 14,
  },
  thinkingLabel: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  subtext: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
    textAlign: "right",
  },
  stop: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "#EF44441F",
    borderWidth: 1,
    borderColor: "#EF444433",
  },
  cancel: {
    color: colors.error,
    fontSize: 11,
    fontWeight: "700",
  },
});
