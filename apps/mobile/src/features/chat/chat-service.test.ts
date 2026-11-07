jest.mock("expo-crypto", () => ({ randomUUID: () => "retry-request-id" }));
jest.mock("../../lib/supabase/client", () => ({ supabase: { from: jest.fn() } }));
jest.mock("../../lib/network/sse-client", () => ({ streamChatPlatform: jest.fn().mockResolvedValue(undefined) }));

import { chatService } from "./chat-service";
import { supabase } from "../../lib/supabase/client";
import { streamChatPlatform } from "../../lib/network/sse-client";
import type { ChatRequestBody } from "../../lib/network/sse-transport";

const fromMock = supabase.from as unknown as jest.Mock;
const streamMock = streamChatPlatform as jest.Mock;

describe("chatService.retryAssistant", () => {
  beforeEach(() => {
    const query = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({
        data: [
          { id: "saved-user-1", conversation_id: "conversation-1", role: "user", content: "Explain this", model_id: null, created_at: "2026-01-01T00:00:00.000Z" },
        ],
        error: null,
      }),
      insert: jest.fn(),
    };
    fromMock.mockReturnValue(query);
    streamMock.mockResolvedValue(undefined);
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
    expect(request.messages).toEqual([{ role: "user", content: "Explain this" }]);
    expect(request.messages.filter((entry) => entry.content === "Explain this")).toHaveLength(1);
  });
});
