import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { useFonts } from "expo-font";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../src/features/auth/auth-provider";
import { initializeAds } from "../src/features/ads/ads-config";
import { ToastProvider } from "../src/components/ui/Toast";
import { colors } from "../src/theme/colors";
import { AnimatedSplash } from "../src/components/AnimatedSplash";

export default function RootLayout() {
  const [loading, setLoading] = useState(true);
  useFonts({
    Cairo_400Regular: require("../assets/fonts/Cairo-Regular.ttf"),
    Cairo_700Bold: require("../assets/fonts/Cairo-Bold.ttf"),
  });

  useEffect(() => {
    void initializeAds().catch(() => undefined);
  }, []);

  if (loading) {
    return <AnimatedSplash onFinish={() => setLoading(false)} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <ToastProvider>
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(protected)" />
            </Stack>
          </ToastProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
