import { Stack, type ErrorBoundaryProps } from "expo-router";
import { useEffect, useState } from "react";
import { useFonts } from "expo-font";
import { Pressable, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../src/features/auth/auth-provider";
import { initializeAds } from "../src/features/ads/ads-config";
import { ToastProvider } from "../src/components/ui/Toast";
import { colors } from "../src/theme/colors";
import { AnimatedSplash } from "../src/components/AnimatedSplash";
import { supabase } from "../src/lib/supabase/client";

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const resetLocalSession = async () => {
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // Local session reset is best-effort; retry remains available below.
    }
    await retry();
  };

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24, backgroundColor: colors.background, gap: 14 }}>
      <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: "700", textAlign: "center" }}>حدث خلل أثناء فتح الشاشة</Text>
      <Text selectable style={{ color: colors.textSecondary, textAlign: "center", lineHeight: 22 }}>{error.message || "خطأ غير معروف"}</Text>
      <Pressable onPress={() => void retry()} style={{ paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, backgroundColor: colors.primary }}>
        <Text style={{ color: colors.background, fontWeight: "700" }}>إعادة المحاولة</Text>
      </Pressable>
      <Pressable onPress={() => void resetLocalSession()} style={{ paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.divider }}>
        <Text style={{ color: colors.textPrimary, fontWeight: "600" }}>إعادة الدخول</Text>
      </Pressable>
    </View>
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
