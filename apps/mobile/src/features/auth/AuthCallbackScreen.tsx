import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { supabase } from "../../lib/supabase/client";
import { mapAuthError } from "./auth-errors";
import { parseAuthCallbackUrl } from "./auth-callback";
import { useAuth } from "./auth-provider";
import { colors } from "../../theme/colors";

export default function AuthCallbackScreen() {
  const router = useRouter();
  const { status, user } = useAuth();
  const handled = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const handleUrl = useCallback(async (url: string) => {
    if (handled.current) return;
    let params;
    try {
      params = parseAuthCallbackUrl(url);
    } catch {
      return;
    }
    if (!params.accessToken && !params.tokenHash && !params.code && !params.errorDescription) return;
    handled.current = true;

    if (params.errorDescription) {
      setError(mapAuthError(params.errorDescription));
      return;
    }

    try {
      if (params.accessToken && params.refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: params.accessToken,
          refresh_token: params.refreshToken,
        });
        if (sessionError) throw sessionError;
      } else if (params.tokenHash) {
        const type = params.type === "recovery" || params.type === "magiclink" ? params.type : "email";
        const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash: params.tokenHash, type });
        if (verifyError) throw verifyError;
      } else if (params.code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(params.code);
        if (exchangeError) throw exchangeError;
      } else {
        throw new Error("Invalid token");
      }
      router.replace("/chat");
    } catch (cause) {
      setError(mapAuthError(cause));
    }
  }, [router]);

  useEffect(() => {
    const subscription = Linking.addEventListener("url", ({ url }) => { void handleUrl(url); });
    void Linking.getInitialURL().then((url) => {
      if (url) void handleUrl(url);
    }).catch(() => undefined);
    return () => subscription.remove();
  }, [handleUrl]);

  if (status === "authenticated" && user) return <Redirect href="/chat" />;
  return (
    <View style={styles.container}>
      {error ? <>
        <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
        <Pressable onPress={() => router.replace("/(auth)/login")} style={styles.button}><Text style={styles.buttonText}>العودة إلى تسجيل الدخول</Text></Pressable>
      </> : <>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.message}>جارٍ تأكيد رابط تسجيل الدخول…</Text>
      </>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", padding: 24 },
  message: { color: colors.textSecondary, textAlign: "center", marginTop: 16 },
  error: { color: colors.error, textAlign: "center", lineHeight: 24 },
  button: { marginTop: 20, paddingVertical: 12, paddingHorizontal: 18, borderRadius: 10, backgroundColor: colors.primary },
  buttonText: { color: colors.textPrimary, fontWeight: "700" },
});
