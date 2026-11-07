import { useState } from "react";
import { Redirect, useRouter } from "expo-router";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../src/features/auth/auth-provider";
import { mapAuthError } from "../../src/features/auth/auth-errors";
import { colors } from "../../src/theme/colors";

type LoginMethod = "otp" | "link";

export default function LoginPage() {
  const router = useRouter();
  const { sendEmailOtp, verifyEmailOtp, sendEmailLink, register, status, user } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [method, setMethod] = useState<LoginMethod>("otp");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  if (status === "authenticated" && user) return <Redirect href="/chat" />;

  const resetMessage = () => {
    setError(null);
    setConfirmation(null);
  };
  const submit = async () => {
    const cleanEmail = email.trim();
    if (busy) return;
    resetMessage();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return setError("أدخل بريدًا إلكترونيًا صحيحًا.");
    if (mode === "register" && password.length < 6) return setError("كلمة المرور يجب ألا تقل عن 6 أحرف.");
    if (mode === "register" && !fullName.trim()) return setError("أدخل الاسم الكامل.");
    if (mode === "login" && method === "otp" && codeSent && !/^\d{6}$/.test(code.trim())) {
      return setError("أدخل رمز التحقق المكوّن من 6 أرقام.");
    }

    setBusy(true);
    try {
      if (mode === "register") {
        const hasSession = await register(cleanEmail, password, fullName);
        if (hasSession) router.replace("/chat");
        else setConfirmation("تم إنشاء الحساب. تحقّق من بريدك الإلكتروني لتأكيده قبل تسجيل الدخول.");
      } else if (method === "otp" && codeSent) {
        await verifyEmailOtp(cleanEmail, code);
        router.replace("/chat");
      } else if (method === "otp") {
        await sendEmailOtp(cleanEmail);
        setCodeSent(true);
        setConfirmation("أرسلنا رمز تحقق من 6 أرقام إلى بريدك الإلكتروني.");
      } else {
        await sendEmailLink(cleanEmail);
        setLinkSent(true);
        setConfirmation("أرسلنا رابط تسجيل الدخول إلى بريدك الإلكتروني. افتحه على هذا الجهاز للمتابعة.");
      }
    } catch (cause) {
      setError(mapAuthError(cause));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    const cleanEmail = email.trim();
    if (busy || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return;
    setBusy(true);
    resetMessage();
    try {
      await sendEmailOtp(cleanEmail);
      setCode("");
      setConfirmation("أرسلنا رمز تحقق جديدًا إلى بريدك الإلكتروني.");
    } catch (cause) {
      setError(mapAuthError(cause));
    } finally {
      setBusy(false);
    }
  };

  const changeLoginMethod = () => {
    setMethod((current) => current === "otp" ? "link" : "otp");
    setCode("");
    setCodeSent(false);
    setLinkSent(false);
    resetMessage();
  };
  const changeMode = () => {
    setMode((current) => current === "login" ? "register" : "login");
    setCodeSent(false);
    setLinkSent(false);
    setCode("");
    resetMessage();
  };
  const changeEmail = (value: string) => {
    setEmail(value);
    setCodeSent(false);
    setLinkSent(false);
    setCode("");
    resetMessage();
  };

  const isRegister = mode === "register";
  const isVerifyingCode = !isRegister && method === "otp" && codeSent;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.brand}>SMSM AI</Text>
            <Text style={styles.subtitle}>مساعد ذكاء اصطناعي للدردشة النصية</Text>
            <Text style={styles.heading}>{isRegister ? "إنشاء حساب" : isVerifyingCode ? "أدخل رمز التحقق" : "تسجيل الدخول"}</Text>
            {isRegister && <TextInput value={fullName} onChangeText={setFullName} placeholder="الاسم الكامل" placeholderTextColor={colors.textMuted} style={styles.input} autoComplete="name" returnKeyType="next" />}
            <TextInput value={email} onChangeText={changeEmail} placeholder="البريد الإلكتروني" placeholderTextColor={colors.textMuted} style={styles.input} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" returnKeyType="next" />

            {isRegister ? (
              <TextInput value={password} onChangeText={setPassword} placeholder="كلمة المرور" placeholderTextColor={colors.textMuted} style={styles.input} secureTextEntry autoComplete="new-password" returnKeyType="go" onSubmitEditing={() => void submit()} />
            ) : isVerifyingCode ? (
              <>
                <Text style={styles.helpText}>أدخل الرمز المكوّن من 6 أرقام الذي أرسلناه إلى بريدك.</Text>
                <TextInput value={code} onChangeText={(value) => setCode(value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" placeholderTextColor={colors.textMuted} style={[styles.input, styles.codeInput]} keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code" maxLength={6} returnKeyType="go" onSubmitEditing={() => void submit()} />
                <Pressable style={styles.secondaryAction} disabled={busy} onPress={() => void resend()}><Text style={styles.link}>إعادة إرسال الرمز</Text></Pressable>
              </>
            ) : null}

            {linkSent && !isRegister && <Pressable style={styles.secondaryAction} disabled={busy} onPress={() => void submit()}><Text style={styles.link}>إعادة إرسال رابط الدخول</Text></Pressable>}
            {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
            {confirmation && <Text accessibilityRole="status" style={styles.success}>{confirmation}</Text>}
            <Pressable style={[styles.button, busy && styles.buttonDisabled]} onPress={() => void submit()} disabled={busy} accessibilityRole="button">
              {busy ? <ActivityIndicator color={colors.textPrimary} /> : <Text style={styles.buttonText}>{isRegister ? "إنشاء الحساب" : isVerifyingCode ? "تأكيد الرمز والدخول" : method === "otp" ? "إرسال رمز التحقق" : "إرسال رابط تسجيل الدخول"}</Text>}
            </Pressable>

            {!isRegister && (
              <Pressable style={styles.modeToggle} disabled={busy} onPress={changeLoginMethod}>
                <Text style={styles.link}>{method === "otp" ? "استخدم رابطًا بالبريد بدل الرمز" : "استخدم رمز تحقق من 6 أرقام بدل الرابط"}</Text>
              </Pressable>
            )}
            <Pressable style={styles.modeToggle} disabled={busy} onPress={changeMode}>
              <Text style={styles.link}>{isRegister ? "لديك حساب؟ تسجيل الدخول" : "إنشاء حساب جديد"}</Text>
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
  codeInput: { textAlign: "center", fontSize: 24, letterSpacing: 8, fontWeight: "700" },
  helpText: { color: colors.textSecondary, textAlign: "right", marginBottom: 10, lineHeight: 22 },
  secondaryAction: { alignSelf: "flex-start", paddingVertical: 6, paddingHorizontal: 4 },
  error: { color: colors.error, marginBottom: 12, textAlign: "right" },
  success: { color: colors.success, marginBottom: 12, textAlign: "right", lineHeight: 22 },
  button: { minHeight: 50, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary, marginTop: 8 },
  buttonDisabled: { opacity: 0.65 },
  buttonText: { color: colors.textPrimary, fontWeight: "700", fontSize: 16, textAlign: "center", paddingHorizontal: 8 },
  modeToggle: { marginTop: 14, alignItems: "center", padding: 8 },
  link: { color: colors.accent, textAlign: "center" },
});
