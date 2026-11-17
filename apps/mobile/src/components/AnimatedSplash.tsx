import React, { useEffect, useRef } from "react";
import { Animated, Easing, Image, Platform, StatusBar, StyleSheet, View } from "react-native";
import * as SplashScreen from "expo-splash-screen";

interface AnimatedSplashProps {
  onFinish?: () => void;
}

export function AnimatedSplash({ onFinish }: AnimatedSplashProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});

    const entranceAnimation = Animated.timing(opacity, {
      toValue: 1,
      duration: 450,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== "web",
    });

    // Smooth continuous 360-degree rotation loader (replaces zoom-in/out pulse)
    const spinAnimation = Animated.loop(
      Animated.timing(rotate, {
        toValue: 1,
        duration: 1600,
        easing: Easing.linear,
        useNativeDriver: Platform.OS !== "web",
      })
    );

    // Schedule the exit before starting animations: if a browser animation
    // driver throws or is unavailable, the app must never remain on a black
    // splash screen indefinitely.
    const timer = setTimeout(() => {
      onFinish?.();
    }, Platform.OS === "web" ? 900 : 2200);

    try {
      entranceAnimation.start();
      spinAnimation.start();
    } catch {
      // The splash is decorative; navigation must not depend on animation support.
      onFinish?.();
    }

    return () => {
      clearTimeout(timer);
      entranceAnimation.stop();
      spinAnimation.stop();
    };
  }, [onFinish, opacity, rotate]);

  const spin = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <Animated.View
        style={[
          styles.glowWrap,
          {
            transform: [{ rotate: spin }],
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
    width: 120,
    height: 120,
    borderRadius: 30,
    backgroundColor: "#000000",
    shadowColor: "#FFFFFF",
    shadowRadius: 28,
    shadowOpacity: 0.16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 20,
    ...Platform.select({
      web: {
        filter: "drop-shadow(0 0 24px rgba(255, 255, 255, 0.16))",
      },
    }),
  },
  icon: {
    width: 120,
    height: 120,
    borderRadius: 30,
  },
});
