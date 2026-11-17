import type { ChatMessage } from "./chat-service";

import { buildRetryHistory, createRetryRequestId } from "./chat-retry";

const message = (id: string, role: ChatMessage["role"], content = id): ChatMessage => ({
  id,
  conversationId: "conversation-1",
  role,
  content,
  createdAt: "2026-01-01T00:00:00.000Z",
  modelId: null,
  status: "sent",
});

describe("buildRetryHistory", () => {
  it("reuses the saved user row once with its prior history and excludes later rows", () => {
    const userMessage = message("saved-user", "user", "Please explain this");
    const messages = [
      message("old-user", "user"),
      message("old-assistant", "assistant"),
      userMessage,
      message("later-assistant", "assistant"),
      message("local-stream", "assistant"),
    ];

    const history = buildRetryHistory(messages, userMessage.id);

    expect(history).toEqual(messages.slice(0, 3));
    expect(history.filter((item) => item.id === userMessage.id)).toHaveLength(1);
    expect(history[history.length - 1].content).toBe("Please explain this");
  });

  it("rejects a missing or non-user retry target", () => {
    expect(() => buildRetryHistory([message("saved-user", "user")], "missing"))
      .toThrow("تعذر العثور على رسالة المستخدم المحفوظة لإعادة المحاولة.");
    expect(() => buildRetryHistory([message("saved-assistant", "assistant")], "saved-assistant"))
      .toThrow("تعذر العثور على رسالة المستخدم المحفوظة لإعادة المحاولة.");
  });
});

describe("createRetryRequestId", () => {
  it("creates a new UUID for each explicit retry", () => {
    const first = createRetryRequestId(() => "11111111-1111-4111-8111-111111111111");
    const second = createRetryRequestId(() => "22222222-2222-4222-8222-222222222222");

    expect(first).toBe("11111111-1111-4111-8111-111111111111");
    expect(second).toBe("22222222-2222-4222-8222-222222222222");
    expect(second).not.toBe(first);
  });
});
