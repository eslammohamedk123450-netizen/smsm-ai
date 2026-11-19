import { useEffect, useRef } from "react";
import { Animated, Easing, Platform, StyleSheet, View } from "react-native";
const brandImage = require("../../../assets/suly-icon.jpg");
type Props = { size?: number; accessibilityLabel?: string; isAnimating?: boolean };
export function AppLogo({ size = 76, accessibilityLabel = "شعار SULY", isAnimating = false }: Props) {
  const rotation = useRef(new Animated.Value(0)).current;
  const useNativeDriver = Platform.OS !== "web";
  useEffect(() => {
    rotation.stopAnimation();
    rotation.setValue(0);
    if (!isAnimating) return;
    let cancelled = false;
    const durations = [2000, 1400, 900];
    const fastSpin = Animated.loop(Animated.timing(rotation, { toValue: 1, duration: 520, easing: Easing.linear, useNativeDriver }));
    const spinStage = (index: number) => {
      if (cancelled) return;
      if (index >= durations.length) { fastSpin.start(); return; }
      Animated.timing(rotation, { toValue: 1, duration: durations[index], easing: Easing.linear, useNativeDriver }).start(({ finished }) => {
        if (!finished || cancelled) return;
        rotation.setValue(0);
        spinStage(index + 1);
      });
    };
    spinStage(0);
    return () => { cancelled = true; fastSpin.stop(); rotation.stopAnimation(); };
  }, [isAnimating, rotation, useNativeDriver]);
  const rotate = rotation.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  return <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel} style={[styles.clip, { width: size, height: size, borderRadius: Math.round(size * 0.22) }]}>
    <Animated.Image source={brandImage} resizeMode="cover" style={[{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }, { width: size, height: size, transform: [{ rotate }] }]} />
  </View>;
}
const styles = StyleSheet.create({ clip: { overflow: "hidden", backgroundColor: "#000000", alignItems: "center", justifyContent: "center" } });