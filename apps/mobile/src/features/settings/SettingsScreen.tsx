import { View, Text, TextInput, Pressable, StyleSheet, SafeAreaView } from "react-native";
import { useAuth } from "../../src/features/auth/auth-provider";
import { useNavigation } from "@expo/router";

export default function SettingsScreen() {
  const { logout } = useAuth();
  const navigation = useNavigation();
  const [email, setEmail] = useState("");

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Settings</Text>
      
      <Text style={styles.section}>Account</Text>
      
      <View style={styles.formGroup}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="your.email@example.com"
          editable={false}
        />
      </View>
      
      <Pressable style={styles.logoutButton} onPress={() => {
        logout().then(() => navigation.replace("(auth)/login"));
      }}>
        <Text style={styles.logoutText}>Log Out</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: "#F5F8FF",
  },
  title: {
    fontSize: 24,
    fontWeight: 600,
    marginBottom: 24,
  },
  section: {
    fontSize: 16,
    color: "#666",
    marginBottom: 12,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    color: "#555",
    marginBottom: 4,
  },
  input: {
    width: "100%",
    height: 48,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  logoutButton: {
    width: "100%",
    height: 48,
    borderRadius: 8,
    backgroundColor: "#EF4444",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
  },
  logoutText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: 500,
  },
});