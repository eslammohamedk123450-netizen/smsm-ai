import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
const brandImage = require("../../../assets/suly-icon.jpg");
type Props = { size?: number; accessibilityLabel?: string; isAnimating?: boolean };
export function AppLogo({ size = 76, accessibilityLabel = "شعار SULY", isAnimating = false }: Props) {
  const rotation = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    rotation.stopAnimation(); rotation.setValue(0);
    if (!isAnimating) return;
    const spin = Animated.loop(Animated.timing(rotation, { toValue: 1, duration: 1800, easing: Easing.linear, useNativeDriver: true }));
    spin.start(); return () => spin.stop();
  }, [isAnimating, rotation]);
  const rotate = rotation.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  return <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel} style={[styles.clip, { width: size, height: size, borderRadius: Math.round(size * 0.22) }]}>
    <Animated.Image source={brandImage} resizeMode="cover" style={[{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }, { width: size, height: size, transform: [{ rotate }] }]} />
  </View>;
}
const styles = StyleSheet.create({ clip: { overflow: "hidden", backgroundColor: "#000000", alignItems: "center", justifyContent: "center" } });
