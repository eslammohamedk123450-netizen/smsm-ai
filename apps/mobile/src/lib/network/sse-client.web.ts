import { supabase } from "../lib/supabase/client";

export interface SseMessage {
  chunk: string;
  done: boolean;
}

export class SseClientWeb {
  private abortController: AbortController | null = null;

  async send(
    url: string,
    body: string,
    onChunk: (chunk: string) => void,
    onDone: () => void,
    onError: (error: Error) => void
  ): Promise<AbortController> {
    this.abortController = new AbortController();

    const tokenResponse = await supabase.auth.getSession();
    const accessToken = tokenResponse.data.session?.access_token;

    return fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
        "apikey": supabase.auth.getUser().then(u => u?.id ?? ""),
      },
      body,
      signal: this.abortController.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body reader");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          buffer += chunk;

          // Parse SSE events - handle data: lines
          const lines = buffer.split(/\n|\r\n/);
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.substring(6));
                if (data.chunk !== undefined) onChunk(data.chunk);
                if (data.done) onDone();
              } catch (e) {
                // Ignore malformed JSON
              }
            }
          }
        }
      })
      .catch((error: Error) => {
        onError(error);
        return this.abortController;
      });
  }

  abort(): void {
    this.abortController?.abort();
  }
}