import { View, Text, StyleSheet } from "react-native";
import { useAuth } from "../../src/features/auth/auth-provider";
import { useNavigation } from "@expo/router";

export default function HomeScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();

  if (!user) {
    navigation.replace("(auth)/login");
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.welcome}>Welcome to SMSM AI</Text>
      <Text style={styles.subtitle}>You are logged in as {user.email}</Text>
      
      <Pressable style={styles.button} onPress={() => navigation.push("(protected)/chat">
        <Text style={styles.buttonText}>Go to Chat</Text>
      </Pressable>
      
      <Pressable style={styles.button} onPress={() => navigation.push("(protected)/settings">
        <Text style={styles.buttonText}>Settings</Text>
      </Pressable>
    </View>
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
  welcome: {
    fontSize: 24,
    fontWeight: 600,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
  },
  button: {
    marginTop: 16,
    padding: 12,
    backgroundColor: "#1A73E8",
    borderRadius: 8,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
  },
});