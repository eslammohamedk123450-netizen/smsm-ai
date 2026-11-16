import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { Redirect, useRouter } from "expo-router";
import { supabase } from "../../lib/supabase/client";
import { mapAuthError } from "./auth-errors";
import { parseAuthCallbackUrl } from "./auth-callback";
import { useAuth } from "./auth-provider";
import { authService } from "./auth-service";
import { useSulyTheme } from "../../theme/ThemeProvider";
import type { ThemePalette } from "../../theme/colors";

WebBrowser.maybeCompleteAuthSession();

type CallbackStatus = "checking" | "processing" | "finished";

export default function AuthCallbackScreen() {
  const { colors } = useSulyTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { status, user } = useAuth();
  const handled = useRef(false);
  const [callbackStatus, setCallbackStatus] = useState<CallbackStatus>("checking");
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
    setCallbackStatus("processing");

    if (params.errorDescription) {
      setError(mapAuthError(params.errorDescription));
      setCallbackStatus("finished");
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
        const allowedTypes = ["signup", "email", "recovery", "magiclink", "invite", "email_change"] as const;
        const type = allowedTypes.includes(params.type as typeof allowedTypes[number])
          ? params.type as typeof allowedTypes[number]
          : "email";
        const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash: params.tokenHash, type });
        if (verifyError) throw verifyError;
      } else if (params.code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(params.code);
        if (exchangeError) throw exchangeError;
      } else {
        throw new Error("Invalid authentication callback.");
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!sessionData.session?.user) throw new Error("Authentication did not return a user session.");

      // The database trigger creates the profile. A profile refresh is best-effort:
      // it must never discard a valid session or prevent the user from entering the app.
      void authService.syncProfile(sessionData.session.user).catch(() => undefined);
      setCallbackStatus("finished");
      router.replace("/home");
    } catch (cause) {
      // Keep any valid local session; never sign the user out because profile sync failed.
      setError(mapAuthError(cause));
      setCallbackStatus("finished");
    }
  }, [router]);

  useEffect(() => {
    let active = true;
    const subscription = Linking.addEventListener("url", ({ url }) => { void handleUrl(url); });
    void Linking.getInitialURL().then((url) => {
      if (!active) return;
      if (url) void handleUrl(url);
      else if (!handled.current) setCallbackStatus("finished");
    }).catch(() => {
      if (active && !handled.current) setCallbackStatus("finished");
    });
    if (Platform.OS === "web") void handleUrl(window.location.href);
    return () => {
      active = false;
      subscription.remove();
    };
  }, [handleUrl]);

  if (status === "authenticated" && user && callbackStatus === "finished" && !error) {
    return <Redirect href="/home" />;
  }

  const waiting = callbackStatus !== "finished" || status === "loading";
  return (
    <View style={styles.container}>
      {waiting ? <>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.message}>
          {callbackStatus === "processing" ? "تم تأكيد البريد، جارٍ تجهيز حسابك…" : "جارٍ استكمال تأكيد البريد وتسجيل الدخول…"}
        </Text>
      </> : error ? <>
        <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
        <Pressable onPress={() => router.replace("/(auth)/login")} style={styles.button}>
          <Text style={styles.buttonText}>العودة إلى تسجيل الدخول</Text>
        </Pressable>
      </> : <>
        <Text style={styles.message}>لم نتمكن من استلام رابط التأكيد. ارجع إلى بريدك وافتح رابط التأكيد على هذا الجهاز، أو سجّل الدخول بالبريد وكلمة المرور.</Text>
        <Pressable onPress={() => router.replace("/(auth)/login")} style={styles.button}>
          <Text style={styles.buttonText}>الانتقال إلى تسجيل الدخول</Text>
        </Pressable>
      </>}
    </View>
  );
}

function createStyles(colors: ThemePalette) { return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", padding: 24, gap: 18 },
  message: { color: colors.textSecondary, textAlign: "center", lineHeight: 24 },
  error: { color: colors.error, textAlign: "center", lineHeight: 24 },
  button: { marginTop: 4, paddingVertical: 12, paddingHorizontal: 18, borderRadius: 10, backgroundColor: colors.primary },
  buttonText: { color: colors.onPrimary, fontWeight: "700" },
}); }
