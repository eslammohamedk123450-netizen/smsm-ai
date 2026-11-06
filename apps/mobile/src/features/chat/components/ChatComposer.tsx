import { View, TextInput, Pressable, StyleSheet, TextInputResizeMode } from "react-native";

export interface ChatComposerProps {
  onSend: (content: string) => void;
  disabled?: boolean;
}

export const ChatComposer = ({ onSend, disabled = false }: ChatComposerProps) => {
  const [text, setText] = useState("");

  const handleSend = () => {
    if (text.trim()) {
      onSend(text);
      setText("");
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        placeholder="Type a message..."
        value={text}
        onChangeText={setText}
        style={styles.input}
        disabled={disabled}
        returnKeyType="send"
        onSubmitEditing={handleSend}
        resizeMode="constant"
      />
      <Pressable style={styles.button} onPress={handleSend} disabled={disabled}>
        <Text style={styles.buttonText}>Send</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    padding: 8,
    backgroundColor: "#F1F3F4",
    borderTopWidth: 1,
    borderTopColor: "#D1D5DB",
  },
  input: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: "#9CA3AF",
    borderRadius: 20,
    paddingHorizontal: 12,
    fontSize: 16,
    marginRight: 8,
  },
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#1A73E8",
    justifyContent: "center",
    alignItems: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
  },
});