import { useState } from "react";
import { Redirect, useRouter } from "expo-router";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../src/features/auth/auth-provider";
import { colors } from "../../src/theme/colors";

export default function LoginPage() {
  const router = useRouter();
  const { login, register, status, user } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  if (status === "authenticated" && user) return <Redirect href="/chat" />;
  const submit = async () => {
    const cleanEmail = email.trim();
    if (busy) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return setError("أدخل بريدًا إلكترونيًا صحيحًا.");
    if (password.length < 6) return setError("كلمة المرور يجب ألا تقل عن 6 أحرف.");
    if (mode === "register" && !fullName.trim()) return setError("أدخل الاسم الكامل.");
    setBusy(true);
    setError(null);
    setConfirmation(null);
    try {
      if (mode === "login") {
        await login(cleanEmail, password);
        router.replace("/chat");
      } else {
        const hasSession = await register(cleanEmail, password, fullName);
        if (hasSession) router.replace("/chat");
        else setConfirmation("تم إنشاء الحساب. تحقق من بريدك الإلكتروني لتأكيده قبل تسجيل الدخول.");
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "تعذر إكمال المصادقة.";
      setError(message.length > 240 ? "تعذر إكمال المصادقة. تحقق من البيانات وحاول مجددًا." : message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.brand}>SMSM AI</Text>
            <Text style={styles.subtitle}>مساعد ذكاء اصطناعي للدردشة النصية</Text>
            <Text style={styles.heading}>{mode === "login" ? "تسجيل الدخول" : "إنشاء حساب"}</Text>
            {mode === "register" && <TextInput value={fullName} onChangeText={setFullName} placeholder="الاسم الكامل" placeholderTextColor={colors.textMuted} style={styles.input} autoComplete="name" returnKeyType="next" />}
            <TextInput value={email} onChangeText={setEmail} placeholder="البريد الإلكتروني" placeholderTextColor={colors.textMuted} style={styles.input} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" returnKeyType="next" />
            <View style={styles.passwordRow}>
              <TextInput value={password} onChangeText={setPassword} placeholder="كلمة المرور" placeholderTextColor={colors.textMuted} style={styles.passwordInput} secureTextEntry={!showPassword} autoComplete={mode === "login" ? "current-password" : "new-password"} returnKeyType="go" onSubmitEditing={() => void submit()} />
              <Pressable onPress={() => setShowPassword((value) => !value)} accessibilityRole="button" accessibilityLabel={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}><Text style={styles.showPassword}>{showPassword ? "إخفاء" : "إظهار"}</Text></Pressable>
            </View>
            {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
            {confirmation && <Text accessibilityRole="status" style={styles.success}>{confirmation}</Text>}
            <Pressable style={[styles.button, busy && styles.buttonDisabled]} onPress={() => void submit()} disabled={busy} accessibilityRole="button">
              {busy ? <ActivityIndicator color={colors.textPrimary} /> : <Text style={styles.buttonText}>{mode === "login" ? "دخول" : "تسجيل"}</Text>}
            </Pressable>
            <Pressable style={styles.modeToggle} disabled={busy} onPress={() => { setMode((value) => value === "login" ? "register" : "login"); setError(null); setConfirmation(null); }}>
              <Text style={styles.link}>{mode === "login" ? "إنشاء حساب جديد" : "لديك حساب؟ تسجيل الدخول"}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scrollView: { flex: 1, width: "100%" },
  scroll: { flexGrow: 1, width: "100%", justifyContent: "center", alignItems: "stretch", padding: 20 },
  card: { width: "100%", maxWidth: 480, alignSelf: "center", padding: 28, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider },
  brand: { color: colors.primary, fontSize: 34, fontWeight: "800", textAlign: "center" },
  subtitle: { color: colors.textSecondary, textAlign: "center", marginTop: 6, marginBottom: 30 },
  heading: { color: colors.textPrimary, fontSize: 22, fontWeight: "700", textAlign: "right", marginBottom: 16 },
  input: { width: "100%", height: 52, borderRadius: 12, borderWidth: 1, borderColor: colors.inputBorder, backgroundColor: colors.inputBackground, color: colors.textPrimary, paddingHorizontal: 14, marginBottom: 12, textAlign: "auto" },
  passwordRow: { minHeight: 52, flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1, borderColor: colors.inputBorder, backgroundColor: colors.inputBackground, paddingHorizontal: 12, marginBottom: 12 },
  passwordInput: { flex: 1, color: colors.textPrimary, paddingVertical: 12, textAlign: "auto" },
  showPassword: { color: colors.accent, padding: 8 },
  error: { color: colors.error, marginBottom: 12, textAlign: "right" },
  success: { color: colors.success, marginBottom: 12, textAlign: "right" },
  button: { minHeight: 50, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary, marginTop: 8 },
  buttonDisabled: { opacity: 0.65 },
  buttonText: { color: colors.textPrimary, fontWeight: "700", fontSize: 16 },
  modeToggle: { marginTop: 18, alignItems: "center", padding: 8 },
  link: { color: colors.accent },
});
