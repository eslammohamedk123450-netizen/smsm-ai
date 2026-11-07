import type { ChatMessage } from "./chat-service";

/** Return saved conversation history through the persisted user message being retried. */
export function buildRetryHistory(messages: ChatMessage[], userMessageId: string): ChatMessage[] {
  const userMessageIndex = messages.findIndex((message) => message.id === userMessageId);
  if (userMessageIndex < 0 || messages[userMessageIndex].role !== "user") {
    throw new Error("تعذر العثور على رسالة المستخدم المحفوظة لإعادة المحاولة.");
  }

  return messages.slice(0, userMessageIndex + 1)
    .filter((message): message is ChatMessage & { role: "user" | "assistant" } => message.role === "user" || message.role === "assistant");
}
