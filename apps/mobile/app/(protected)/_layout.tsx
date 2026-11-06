import { View, StyleSheet } from "react-native";
import { useNavigation } from "@expo/router";
import { useAuth } from "../../src/features/auth/auth-provider";

export default function ProtectedLayout() {
  const { user, loading } = useAuth();
  const navigation = useNavigation();

  if (loading) {
    return null; // Let the parent handle loading
  }

  if (!user) {
    navigation.replace("(auth)/login");
    return null;
  }

  return null;
}

const styles = StyleSheet.create({});