import React, { useEffect, useRef } from "react";
import { Animated, Easing, Image, Platform, StatusBar, StyleSheet, View } from "react-native";
import * as SplashScreen from "expo-splash-screen";

interface AnimatedSplashProps {
  onFinish?: () => void;
}

export function AnimatedSplash({ onFinish }: AnimatedSplashProps) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});

    const entranceAnimation = Animated.timing(opacity, {
      toValue: 1,
      duration: 450,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== "web",
    });

    // Schedule the exit before starting animations: if a browser animation
    // driver throws or is unavailable, the app must never remain on a black
    // splash screen indefinitely.
    const timer = setTimeout(() => {
      onFinish?.();
    }, Platform.OS === "web" ? 900 : 2200);

    try {
      entranceAnimation.start();
    } catch {
      // The splash is decorative; navigation must not depend on animation support.
      onFinish?.();
    }

    return () => {
      clearTimeout(timer);
      entranceAnimation.stop();
    };
  }, [onFinish, opacity, rotate]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <Animated.View
        style={[
          styles.glowWrap,
          {
            opacity,
          },
        ]}
      >
        <Image
          source={require("../../assets/suly-icon.jpg")}
          style={styles.icon}
          resizeMode="contain"
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
    width: 160,
    height: 240,
    borderRadius: 0,
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
