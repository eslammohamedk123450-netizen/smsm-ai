import { View, ActivityIndicator, Text, StyleSheet } from "react-native";

export interface StreamingStatusProps {
  isStreaming: boolean;
  error?: string;
}

export const StreamingStatus = ({ isStreaming, error }: StreamingStatusProps) => {
  if (error) {
    return (
      <View style={styles.error}>
        <Text style={styles.errorText}>Error: {error}</Text>
      </View>
    );
  }

  if (isStreaming) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size "small" color="#1A73E8" />
        <Text style={styles.text}>Generating response...</Text>
      </View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  container: {
    padding: 8,
    marginTop: 4,
    backgroundColor: "#F1F3F4",
    borderRadius: 8,
  },
  error: {
    padding: 8,
    backgroundColor: "#CF1A2A",
    borderRadius: 8,
    marginTop: 4,
  },
  errorText: {
    color: "#FFFFFF",
    fontSize: 12,
  },
  text: {
    color: "#1A1A1A",
    fontSize: 14,
    marginLeft: 4,
  },
});