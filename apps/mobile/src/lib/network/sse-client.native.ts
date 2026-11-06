import { fetch as expoFetch } from "expo/fetch";
import { streamChat, type ChatRequestBody, type StreamCallbacks } from "./sse-transport";

export function streamChatPlatform(body: ChatRequestBody, signal: AbortSignal, callbacks: StreamCallbacks): Promise<void> {
  return streamChat(expoFetch as typeof globalThis.fetch, body, signal, callbacks);
}
