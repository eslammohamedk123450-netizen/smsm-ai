jest.mock("../../lib/network/sse-client", () => ({ streamChatPlatform: jest.fn() }));

import { chatStreamManager } from "./chat-stream-manager";
import { streamChatPlatform } from "../../lib/network/sse-client";
import type { ChatRequestBody } from "../../lib/network/sse-transport";

const streamMock = streamChatPlatform as jest.Mock;
const request = (conversationId: string): ChatRequestBody => ({
  conversation_id: conversationId,
  user_message_id: "user-message-1",
  request_id: "request-1",
  messages: [{ role: "user", content: "hello" }],
  routing_mode: "auto",
  model_profile_key: "auto",
  execution_mode: "auto",
  stream: true,
});

describe("chatStreamManager", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    streamMock.mockReset();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("publishes streamed text and terminal state to a reattached listener", async () => {
    streamMock.mockImplementation(async (_body: ChatRequestBody, _signal: AbortSignal, callbacks: {
      onChunk(text: string): void;
      onTaskUpdate(task: { task: string; status: "pending" | "running" | "completed" | "failed" }): void;
      onDone(): void;
    }) => {
      callbacks.onChunk("hello ");
      callbacks.onChunk("world");
      callbacks.onTaskUpdate({ task: "planning", status: "completed" });
      callbacks.onDone();
    });

    const promise = chatStreamManager.start(request("conversation-stream"), {
      onChunk: jest.fn(),
      onDone: jest.fn(),
    });
    const snapshots: Array<{ active: boolean; text: string; taskLabel: string | null }> = [];
    const unsubscribe = chatStreamManager.subscribe("conversation-stream", (snapshot) => snapshots.push(snapshot));
    await promise;

    expect(streamMock).toHaveBeenCalledTimes(1);
    expect(chatStreamManager.getSnapshot("conversation-stream")).toMatchObject({ active: false, text: "hello world", taskLabel: "تم planning" });
    expect(snapshots[0]).toMatchObject({ active: true, text: "hello world" });
    expect(snapshots[snapshots.length - 1].active).toBe(false);
    unsubscribe();
  });

  it("cancels the active stream and records a terminal snapshot", async () => {
    streamMock.mockImplementation((_body: ChatRequestBody, signal: AbortSignal) => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    }));

    const promise = chatStreamManager.start(request("conversation-cancel"), {
      onChunk: jest.fn(),
      onDone: jest.fn(),
    });
    chatStreamManager.cancel("conversation-cancel");
    await expect(promise).rejects.toThrow("aborted");
    expect(chatStreamManager.getSnapshot("conversation-cancel")).toMatchObject({ active: false, error: "aborted" });
  });

  it("does not start a second stream for an already-active conversation", async () => {
    let finish: (() => void) | undefined;
    streamMock.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
    const first = chatStreamManager.start(request("conversation-single"), { onChunk: jest.fn(), onDone: jest.fn() });
    const second = chatStreamManager.start(request("conversation-single"), { onChunk: jest.fn(), onDone: jest.fn() });
    expect(second).toBe(first);
    expect(streamMock).toHaveBeenCalledTimes(1);
    finish?.();
    await first;
  });
});
