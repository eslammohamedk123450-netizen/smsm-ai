import { View, Text, StyleSheet, SafeAreaView, Pressable, ActivityIndicator } from "react-native";
import { useAuth } from "../../src/features/auth/auth-provider";
import { adminService } from "../../src/features/admin/admin-service";
import { useRoute } from "@expo/router";

export default function CircuitBreakerScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Placeholder - implement based on Flutter circuit_breaker_tab.dart
    setIsLoading(false);
  }, []);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Circuit Breaker</Text>
      <Text style={styles.placeholder}>Circuit Breaker management tab</Text>
      <Text style={styles.info}>This feature is under development.</Text>
      <Pressable style={styles.back} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>Back</Text>
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
  placeholder: {
    color: "#888",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 16,
  },
  info: {
    color: "#666",
    fontSize: 14,
    textAlign: "center",
  },
  back: {
    marginTop: 24,
    alignSelf: "flex-end",
  },
  backText: {
    color: "#1A73E8",
    fontWeight: 500,
  },
});