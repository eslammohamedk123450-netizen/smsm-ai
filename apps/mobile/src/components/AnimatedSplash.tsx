import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Image,
  Platform,
  StatusBar,
  StyleSheet,
  View,
} from "react-native";
import * as SplashScreen from "expo-splash-screen";

// Prevent native splash from hiding automatically
SplashScreen.preventAutoHideAsync().catch(() => {});

interface AnimatedSplashProps {
  onFinish?: () => void;
}

export function AnimatedSplash({ onFinish }: AnimatedSplashProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;
  const glow = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    // Hide native splash once custom animated splash mounts
    SplashScreen.hideAsync().catch(() => {});

    // Step 1: Fade in faintly from opacity 0 to 0.35 in 600ms (ChatGPT-like faint intro)
    // Step 2: Fade to 1 in 700ms + scale 0.9 to 1.05 with spring, easeOutBack
    // Step 3: Breathing loop while loading: scale 1.0 -> 1.07 -> 1.0 + cyan glow pulse
    const entranceAnimation = Animated.sequence([
      Animated.timing(opacity, {
        toValue: 0.35,
        duration: 600,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1.05,
          friction: 6,
          tension: 45,
          useNativeDriver: true,
        }),
      ]),
    ]);

    const breathingAnimation = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 1.07,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(glow, {
            toValue: 1,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 1.0,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(glow, {
            toValue: 0.4,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ])
    );

    entranceAnimation.start(() => {
      breathingAnimation.start();
    });

    // After 2.5 seconds total, call onFinish()
    const timer = setTimeout(() => {
      onFinish?.();
    }, 2500);

    return () => {
      clearTimeout(timer);
      entranceAnimation.stop();
      breathingAnimation.stop();
    };
  }, [glow, onFinish, opacity, scale]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <Animated.View
        style={[
          styles.glowWrap,
          {
            transform: [{ scale }],
            opacity,
          },
        ]}
      >
        <Image
          source={require("../../assets/suly-icon.png")}
          style={styles.icon}
          resizeMode="cover"
          accessibilityLabel="Suly Icon"
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#000000",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  glowWrap: {
    width: 130,
    height: 130,
    borderRadius: 32,
    backgroundColor: "#000000",
    shadowColor: "#00E5FF",
    shadowRadius: 30,
    shadowOpacity: 0.85,
    shadowOffset: { width: 0, height: 0 },
    elevation: 20,
    ...Platform.select({
      web: {
        filter: "drop-shadow(0 0 30px rgba(0, 229, 255, 0.85))",
      },
    }),
  },
  icon: {
    width: 130,
    height: 130,
    borderRadius: 32,
  },
});
