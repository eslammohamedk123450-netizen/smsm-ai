import { View, Text, StyleSheet, SafeAreaView, Pressable, ActivityIndicator } from "react-native";
import { useAuth } from "../../src/features/auth/auth-provider";
import { supabase } from "../../src/lib/supabase/client";
import { useNavigation } from "@expo/router";

export default function AdminIndex() {
  const { user } = useAuth();
  const navigation = useNavigation();

  // Check admin using user role from profiles table (matches backend suly_is_admin policy)
  // The profiles table has role CHECK (role IN ('user', 'admin'))
  const isAdmin = user?.role === "admin";

  if (loadingAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  if (!user) {
    navigation.replace("(auth)/login");
    return null;
  }

  if (!isAdmin) {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>Access Denied: Admin only</Text>
        <Pressable style={styles.back} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Admin Panel</Text>
      <Pressable style={styles.link} onPress={() => navigation.push("admin/dashboard">
        <Text style={styles.linkText}>Dashboard</Text>
      </Pressable>
      <Pressable style={styles.link} onPress={() => navigation.push("admin/api-keys">
        <Text style={styles.linkText}>API Keys</Text>
      </Pressable>
      <Pressable style={styles.link} onPress={() => navigation.push("admin/models">
        <Text style={styles.linkText}>Models</Text>
      </Pressable>
      <Pressable style={styles.link} onPress={() => navigation.push("admin/users">
        <Text style={styles.linkText}>Users</Text>
      </Pressable>
      <Pressable style={styles.link} onPress={() => navigation.push("admin/circuit-breaker">
        <Text style={styles.linkText}>Circuit Breaker</Text>
      </Pressable>
      <Pressable style={styles.link} onPress={() => navigation.push("admin/credit-management">
        <Text style={styles.linkText}>Credit Management</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#F5F8FF",
  },
  title: {
    fontSize: 24,
    fontWeight: 600,
    marginBottom: 24,
  },
  error: {
    color: "#EF4444",
    fontSize: 16,
  },
  back: {
    marginTop: 16,
  },
  backText: {
    color: "#1A73E8",
  },
  link: {
    marginTop: 16,
  },
  linkText: {
    color: "#1A73E8",
    textDecorationLine: "underline",
  },
});