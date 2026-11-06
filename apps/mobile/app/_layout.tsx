import { View, StyleSheet } from "react-native";
import { useRouter } from "@expo/router";
import { useAuth } from "../../src/features/auth/auth-provider";

export default function AppLayout() {
  const router = useRouter();
  const { user, loading } = useAuth();

  if (loading) {
    return null; // Parent will show loading screen
  }

  if (!user) {
    router.replace("(auth)/login");
    return null;
  }

  return null;
}

const styles = StyleSheet.create({});