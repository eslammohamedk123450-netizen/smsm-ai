jest.mock("expo-crypto", () => ({ randomUUID: () => "retry-request-id" }));
jest.mock("../../lib/supabase/client", () => ({ supabase: { from: jest.fn(), auth: { getSession: jest.fn(), getUser: jest.fn() }, functions: { invoke: jest.fn() } } }));
jest.mock("../../lib/network/sse-client", () => ({ streamChatPlatform: jest.fn().mockResolvedValue(undefined) }));

import { chatService } from "./chat-service";
import { supabase } from "../../lib/supabase/client";
import { streamChatPlatform } from "../../lib/network/sse-client";
import type { ChatRequestBody } from "../../lib/network/sse-transport";

const fromMock = supabase.from as unknown as jest.Mock;
const streamMock = streamChatPlatform as jest.Mock;

describe("chatService.retryAssistant", () => {
  beforeEach(() => {
    streamMock.mockClear();
    fromMock.mockClear();
    (supabase.auth.getSession as unknown as jest.Mock).mockResolvedValue({ data: { session: null }, error: null });
    (supabase.auth.getUser as unknown as jest.Mock).mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    (supabase.functions.invoke as unknown as jest.Mock).mockResolvedValue({ data: { assets: [] }, error: null });
    const messagesQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({
        data: [
          { id: "saved-user-1", conversation_id: "conversation-1", role: "user", content: "Explain this", model_id: null, created_at: "2026-01-01T00:00:00.000Z" },
        ],
        error: null,
      }),
      insert: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { id: "new-user-1", conversation_id: "conversation-1", role: "user", content: "Hello", model_id: null, created_at: "2026-01-01T00:00:01.000Z" }, error: null }),
    };
    const conversationQuery = {
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
    };
    const assetsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: [], error: null }),
    };
    fromMock.mockImplementation((table: string) => table === "global_media_assets" ? assetsQuery : table === "suly_conversations" ? conversationQuery : messagesQuery);
    streamMock.mockResolvedValue(undefined);
  });

  it("forwards the server-confirmed model identifier through the retry stream", async () => {
    const onModelInfo = jest.fn();
    const controller = new AbortController();
    await chatService.retryAssistant({
      conversationId: "conversation-1",
      userMessageId: "saved-user-1",
      signal: controller.signal,
      onChunk: jest.fn(),
      onModelInfo,
    });

    const callbacks = streamMock.mock.calls[0][2] as { onModelInfo?: (identifier: string) => void };
    expect(callbacks.onModelInfo).toBeDefined();
    callbacks.onModelInfo?.("openai/gpt-oss-120b");
    expect(onModelInfo).toHaveBeenCalledWith("openai/gpt-oss-120b");
  });

  it("forwards the server-confirmed model identifier on a normal new message", async () => {
    const onModelInfo = jest.fn();
    await chatService.sendMessage({
      conversationId: "conversation-1",
      content: "Hello",
      signal: new AbortController().signal,
      onUserSaved: jest.fn(),
      onChunk: jest.fn(),
      onModelInfo,
    });

    const callbacks = streamMock.mock.calls[0][2] as { onModelInfo?: (identifier: string) => void };
    callbacks.onModelInfo?.("openai/gpt-oss-120b");
    expect(onModelInfo).toHaveBeenCalledWith("openai/gpt-oss-120b");
  });

  it("reuses the persisted message in request history without inserting a duplicate row", async () => {
    const controller = new AbortController();
    await chatService.retryAssistant({
      conversationId: "conversation-1",
      userMessageId: "saved-user-1",
      signal: controller.signal,
      onChunk: jest.fn(),
    });

    const query = fromMock.mock.results[0].value;
    expect(fromMock).toHaveBeenCalledWith("suly_messages");
    expect(query.insert).not.toHaveBeenCalled();
    const request = streamMock.mock.calls[0][0] as ChatRequestBody;
    expect(request.execution_mode).toBe("auto");
    expect(request.request_id).toBe("retry-request-id");
    expect(request).not.toHaveProperty("confirmed_connector_action");
    expect(request.messages).toEqual([{ role: "user", content: "Explain this" }]);
    expect(request.messages.filter((entry) => entry.content === "Explain this")).toHaveLength(1);
  });
});
