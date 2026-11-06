import { View, Text, StyleSheet, SafeAreaView } from "react-native";
import { useAuth } from "../../src/features/auth/auth-provider";
import { useNavigation } from "@expo/router";

export default function SettingsPage() {
  const { user } = useAuth();
  const navigation = useNavigation();

  if (!user) {
    navigation.replace("(auth)/login");
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Settings</Text>
      
      <View style={styles.section}>
        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{user.email}</Text>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.label}>Role</Text>
        <Text style={styles.value}>{user.role}</Text>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.label}>Credit Balance</Text>
        <Text style={styles.value}>{user.credit_balance}</Text>
      </View>
      
      <Pressable style={styles.logout} onPress={() => {
        user.logout().then(() => navigation.replace("(auth)/login"));
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
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: "#555",
    marginBottom: 4,
  },
  value: {
    color: "#1A1A1A",
  },
  logout: {
    width: "100%",
    height: 48,
    borderRadius: 8,
    backgroundColor: "#EF4444",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 24,
  },
  logoutText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: 500,
  },
});