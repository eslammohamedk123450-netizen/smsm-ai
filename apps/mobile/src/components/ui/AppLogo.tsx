import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
const brandImage = require("../../../assets/suly-icon.jpg");
type Props = { size?: number; accessibilityLabel?: string; isAnimating?: boolean };
export function AppLogo({ size = 76, accessibilityLabel = "شعار SULY", isAnimating = false }: Props) {
  const rotation = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    rotation.stopAnimation(); rotation.setValue(0);
    if (!isAnimating) return;
    const accelerate = Animated.sequence([
      Animated.timing(rotation, { toValue: 1, duration: 2000, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(rotation, { toValue: 1, duration: 1400, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(rotation, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true }),
      Animated.loop(Animated.timing(rotation, { toValue: 1, duration: 520, easing: Easing.linear, useNativeDriver: true })),
    ]);
    accelerate.start(); return () => accelerate.stop();
  }, [isAnimating, rotation]);
  const rotate = rotation.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  return <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel} style={[styles.clip, { width: size, height: size, borderRadius: Math.round(size * 0.22) }]}>
    <Animated.Image source={brandImage} resizeMode="cover" style={[{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }, { width: size, height: size, transform: [{ rotate }] }]} />
  </View>;
}
const styles = StyleSheet.create({ clip: { overflow: "hidden", backgroundColor: "#000000", alignItems: "center", justifyContent: "center" } });
