import { useEffect, useMemo, useRef } from "react";
import { Animated, Modal, PanResponder, Pressable, StyleSheet, View, useColorScheme } from "react-native";
import { PremiumText as Text } from "./PremiumText";
import { getThemeColors } from "../../theme/colors";
import { theme } from "../../theme/theme";

type Props = {
  visible: boolean;
  title?: string;
  onClose(): void;
  children: React.ReactNode;
};

export function BottomSheet({ visible, title, onClose, children }: Props) {
  const mode = useColorScheme() === "light" ? "light" : "dark";
  const palette = getThemeColors(mode);
  const translateY = useRef(new Animated.Value(420)).current;
  const backdrop = useRef(new Animated.Value(0)).current;
  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) => gesture.dy > 8,
    onPanResponderMove: (_event, gesture) => translateY.setValue(Math.max(0, gesture.dy)),
    onPanResponderRelease: (_event, gesture) => {
      if (gesture.dy > 100 || gesture.vy > 1.1) onClose();
      else Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 24, stiffness: 240, mass: 0.8 }).start();
    },
  }), [onClose, translateY]);

  useEffect(() => {
    if (!visible) return;
    translateY.setValue(420);
    backdrop.setValue(0);
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 24, stiffness: 240, mass: 0.8 }),
      Animated.timing(backdrop, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
  }, [backdrop, translateY, visible]);

  const close = () => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: 420, duration: 170, useNativeDriver: true }),
      Animated.timing(backdrop, { toValue: 0, duration: 150, useNativeDriver: true }),
    ]).start(onClose);
  };

  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType="none" onRequestClose={close}>
      <View style={styles.root}>
        <Animated.View style={[styles.overlay, { opacity: backdrop, backgroundColor: palette.background }]} />
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityRole="button" accessibilityLabel="إغلاق النافذة" />
        <Animated.View
          {...panResponder.panHandlers}
          accessibilityViewIsModal
          style={[styles.sheet, { backgroundColor: palette.surface, borderColor: palette.divider, shadowColor: palette.background, transform: [{ translateY }] }]}
        >
          <View style={styles.grabArea}><View style={[styles.grabber, { backgroundColor: palette.textMuted }]} /></View>
          {title ? <Text style={[styles.title, { color: palette.textPrimary }]}>{title}</Text> : null}
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  overlay: { ...StyleSheet.absoluteFill, opacity: 0.55 },
  sheet: { width: "100%", maxHeight: "88%", borderTopLeftRadius: theme.borderRadius.lg + 8, borderTopRightRadius: theme.borderRadius.lg + 8, borderWidth: 1, paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xl, shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.18, shadowRadius: 22, elevation: 20 },
  grabArea: { height: 30, alignItems: "center", justifyContent: "center" },
  grabber: { width: 42, height: 4, borderRadius: theme.borderRadius.full },
  title: { textAlign: "right", fontSize: theme.typography.h3.fontSize, fontWeight: "700", marginBottom: theme.spacing.md },
});
