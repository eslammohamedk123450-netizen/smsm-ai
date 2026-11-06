import { View, Text, StyleSheet } from "react-native";

export interface ChatErrorBannerProps {
  isError: boolean;
  error?: string;
  onRetry?: () => void;
}

export const ChatErrorBanner = ({ isError, error, onRetry }: ChatErrorBannerProps) => {
  if (!isError) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.message}>{error || "An error occurred"}</Text>
      {onRetry && (
        <Pressable style={styles.retryButton} onPress={onRetry}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    backgroundColor: "#CF1A2A",
    padding: 12,
    marginBottom: 12,
    borderRadius: 8,
  },
  message: {
    color: "#FFFFFF",
    fontSize: 14,
  },
  retryButton: {
    marginTop: 4,
    alignSelf: "flex-end",
  },
  retryText: {
    color: "#FFFFFF",
    fontSize: 12,
    textDecorationLine: "underline",
  },
});