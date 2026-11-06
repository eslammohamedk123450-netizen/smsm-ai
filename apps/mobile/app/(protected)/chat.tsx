import { View, FlatList, Text, StyleSheet, ScrollToEnd, RefreshControl } from "react-native";
import { useAuth } from "../../src/features/auth/auth-provider";
import { useChat } from "../../src/features/chat/chat-service";
import { sendMessage, getMessages, Message } from "../../src/features/chat/chat-service";
import { MessageBubble } from "../../src/features/chat/components/MessageBubble";
import { ChatComposer } from "../../src/features/chat/components/ChatComposer";
import { StreamingStatus } from "../../src/features/chat/components/StreamingStatus";
import { ChatErrorBanner } from "../../src/features/chat/components/ChatErrorBanner";
import { useEffect, useState } from "react";
import { useNavigation } from "@expo/router";

export default function ChatPage() {
  const { user } = useAuth();
  const { sendSseMessage, getMessages: fetchMessages, subscribeToMessages } = useChat();
  const navigation = useNavigation();
  [messages, setMessages] = useState<Message[]>([]);
  [input, setInput] = useState("");
  [isLoading, setIsLoading] = useState(false);
  [error, setError] = useState<string | undefined>(undefined);
  [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    // Load messages when conversation changes or on mount
    const loadMessages = async () => {
      if (!user) return;
      try {
        const convId = navigation?.getParam?.("conversationId");
        if (convId) {
          const fetched = await fetchMessages(convId);
          setMessages(fetched);
        }
      } catch (err: any) {
        setError(err.message);
      }
    };

    loadMessages();
    
    // Set up subscription to new messages
    const convId = navigation?.getParam?.("conversationId");
    if (convId && !isSubscribed) {
      const unsubscribe = subscribeToMessages(
        convId,
        (message: Message) => {
          setMessages(prev => [message, ...prev]);
        },
        (err: Error) => {
          setError(err.message);
        }
      );
      setIsSubscribed(true);
      return () => {
        unsubscribe();
        setIsSubscribed(false);
      };
    }

    return () => {
      if (isSubscribed) {
        // cleanup subscription
      }
    };
  }, [user, navigation, isSubscribed]);

  const handleSend = async (content: string) => {
    if (!content.trim() || isLoading) return;
    
    setIsLoading(true);
    setError(undefined);
    
    try {
      // Send message via SSE
      const abortController = await sendSseMessage(
        content,
        navigation.getParam("conversationId") || "",
        undefined,
        (chunk: string) => {
          // Handle streaming chunk
          console.log("Chunk:", chunk);
        },
        () => {
          // Stream done
          console.log("Done");
        },
        (err: Error) => {
          setError(err.message);
        }
      );
      
      // Clean up if needed
      return () => {
        abortController?.abort();
      };
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const renderMessage = (message: Message) => (
    <MessageBubble
      role={message.role}
      content={message.content}
      model={message.modelId}
    />
  );

  if (!user) {
    return null;
  }

  return (
    <View style={styles.container}>
      <ChatErrorBanner 
        isError={!!error} 
        error={error} 
        onRetry={() => setError(undefined)} 
      />
      <FlatList
        data={messages}
        renderItem={({ item }) => renderMessage(item)}
        keyExtractor={(item, index) => index.toString()}
        inverted
        onEndReach={ScrollToEnd}
        scrollEventThrottle=16
      />
      <StreamingStatus isStreaming={isLoading} error={error} />
      <ChatComposer onSend={handleSend} disabled={isLoading} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F8FF",
  },
});