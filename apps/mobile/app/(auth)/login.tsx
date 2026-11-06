import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet, SafeAreaView } from "react-native";
import { useAuth } from "../../src/features/auth/auth-provider";
import { useNavigation } from "@expo-router";
import { colors, theme } from "../../src/theme";

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const navigation = useNavigation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [disabled, setDisabled] = useState(false);

  const handleLogin = async () => {
    setDisabled(true);
    try {
      await login(email, password);
      navigation.push("(protected)/chat");
    } catch (err: any) {
      alert(err.message || "Login failed");
    } finally {
      setDisabled(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Welcome Back</Text>
      <Text style={styles.subtitle}>Sign in to your account</Text>
      
      <Text style={styles.inputLabel}>Email</Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="Enter your email"
        autoCapitalize="none"
      />
      
      <Text style={styles.inputLabel}>Password</Text>
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder="Enter your password"
      />
      
      <Pressable
        style={styles.button}
        onPress={handleLogin}
        disabled={disabled}
      >
        <Text style={styles.buttonText}>{disabled ? "Signing in..." : "Sign In"}</Text>
      </Pressable>
      
      <Text style={styles.forgotPassword} onPress={() => navigation.replace("ForgotPassword")}>
        Forgot password?
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing.md,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: theme.typography.h1.fontSize,
    fontWeight: theme.typography.h1.fontWeight,
    marginBottom: theme.spacing.sm,
    color: theme.colors.onBackground,
  },
  subtitle: {
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.onBackground,
    opacity: 0.7,
    marginBottom: theme.spacing.lg,
  },
  inputLabel: {
    fontSize: theme.typography.caption.fontSize,
    color: theme.colors.onSurface,
    marginBottom: theme.spacing.xs,
  },
  input: {
    width: "100%",
    height: 50,
    borderWidth: 1,
    borderColor: theme.colors.inputBackground,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    fontSize: theme.typography.body.fontSize,
    backgroundColor: theme.colors.inputBackground,
    marginBottom: theme.spacing.md,
    color: theme.colors.inputText,
  },
  button: {
    width: "100%",
    height: 50,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginTop: theme.spacing.sm,
  },
  buttonText: {
    color: theme.colors.onPrimary,
    fontSize: theme.typography.body.fontSize,
    fontWeight: 500,
  },
  forgotPassword: {
    marginTop: theme.spacing.md,
    color: theme.colors.primary,
    textAlign: "center",
  },
});