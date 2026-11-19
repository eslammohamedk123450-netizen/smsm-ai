import { Stack, type ErrorBoundaryProps } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { useFonts } from "expo-font";
import { Pressable, Text, View, useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../src/features/auth/auth-provider";
import { initializeAds } from "../src/features/ads/ads-config";
import { ToastProvider } from "../src/components/ui/Toast";
import { getThemeColors } from "../src/theme/colors";
import { AnimatedSplash } from "../src/components/AnimatedSplash";
import { SulyThemeProvider, useSulyTheme } from "../src/theme/ThemeProvider";
import { LocaleProvider, useAppLocale } from "../src/theme/LocaleProvider";

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const systemScheme = useColorScheme();
  const colors = getThemeColors(systemScheme === "dark" ? "dark" : "light");
  const isStaleBundleError = /Loading module .* failed|ChunkLoadError|Failed to fetch dynamically imported module|Importing a module script failed/i.test(error.message || "");

  const handleRecovery = async () => {
    if (isStaleBundleError && typeof window !== "undefined") {
      try {
        const registrations = await navigator.serviceWorker?.getRegistrations();
        await Promise.all((registrations ?? []).map((registration) => registration.unregister()));
      } catch {
        // Continue with the cache-busting reload even if service-worker cleanup is unavailable.
      }
      try {
        if ("caches" in window) {
          const cacheNames = await window.caches.keys();
          await Promise.all(cacheNames.map((cacheName) => window.caches.delete(cacheName)));
        }
      } catch {
        // The reload below remains the primary recovery path.
      }
      const freshUrl = new URL(window.location.href);
      freshUrl.searchParams.set("_suly_reload", String(Date.now()));
      window.location.replace(freshUrl.toString());
      return;
    }
    await retry();
  };

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24, backgroundColor: colors.background, gap: 14 }}>
      <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: "700", textAlign: "center" }}>حدث خلل أثناء فتح الشاشة</Text>
      <Text selectable style={{ color: colors.textSecondary, textAlign: "center", lineHeight: 22 }}>{error.message || "خطأ غير معروف"}</Text>
      <Pressable onPress={() => void handleRecovery()} style={{ paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, backgroundColor: colors.primary }}>
        <Text style={{ color: colors.onPrimary, fontWeight: "700" }}>{isStaleBundleError ? "تحديث التطبيق" : "إعادة المحاولة"}</Text>
      </Pressable>
    </View>
  );
}

function AppNavigator() {
  const { colors: palette, effectiveMode } = useSulyTheme();
  const { direction } = useAppLocale();
  return (
    <>
    <StatusBar style={effectiveMode === "dark" ? "light" : "dark"} />
    <AuthProvider>
      <ToastProvider>
        <View style={{ flex: 1, direction }}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.background } }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(protected)" />
        </Stack>
        </View>
      </ToastProvider>
    </AuthProvider>
    </>
  );
}

export default function RootLayout() {
  const [loading, setLoading] = useState(true);
  useFonts({
    Cairo_400Regular: require("../assets/fonts/Cairo-Regular.ttf"),
    Cairo_700Bold: require("../assets/fonts/Cairo-Bold.ttf"),
  });

  useEffect(() => {
    void initializeAds().catch(() => undefined);
  }, []);

  if (loading) return <AnimatedSplash onFinish={() => setLoading(false)} />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SulyThemeProvider>
          <LocaleProvider>
            <AppNavigator />
          </LocaleProvider>
        </SulyThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
