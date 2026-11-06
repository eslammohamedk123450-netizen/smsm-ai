import { View, Text, StyleSheet } from "react-native";
import { colors, theme } from "../../theme";

export interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
  model?: string;
}

export const MessageBubble = ({ role, content, model }: MessageBubbleProps) => {
  const isUser = role === "user";

  return (
    <View style={styles.container[isUser ? "user" : "assistant"]}>
      <Text style={styles.text[isUser ? "user" : "assistant"]}>
        {content}
      </Text>
      {model && (
        <Text style={styles.caption}>
          {model}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    user: {
      alignSelf: "flex-end",
      maxWidth: "75%",
      marginBottom: theme.spacing.md,
    },
    assistant: {
      alignSelf: "flex-start",
      maxWidth: "75%",
      marginBottom: theme.spacing.md,
    },
  text: {
    user: {
      backgroundColor: colors.chatBubbleUser,
      color: colors.chatBubbleUserText,
      padding: theme.spacing.sm,
      borderRadius: theme.borderRadius.md,
      fontSize: theme.typography.body.fontSize,
    },
    assistant: {
      backgroundColor: colors.chatBubbleAssistant,
      color: colors.chatBubbleAssistantText,
      padding: theme.spacing.sm,
      borderRadius: theme.borderRadius.md,
      fontSize: theme.typography.body.fontSize,
    },
  },
  caption: {
    marginTop: theme.spacing.xs,
    fontSize: theme.typography.caption.fontSize,
    opacity: 0.6,
    textAlign: "right",
  },
});