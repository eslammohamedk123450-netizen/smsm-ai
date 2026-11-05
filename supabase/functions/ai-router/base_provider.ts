import { ProviderConfig, HealthCheckResult, StreamResult } from './types.ts';

export abstract class BaseProvider {
  protected config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  abstract chatStream(messages: Array<{ role: string; content: string }>): Promise<StreamResult>;

  abstract getModels(): Promise<Array<{ name: string; displayName: string; maxTokens: number }>>;

  abstract checkHealth(): Promise<HealthCheckResult>;

  protected createSseTransformStream(): {
    stream: ReadableStream<Uint8Array>;
    writer: WritableStreamDefaultWriter<Uint8Array>;
    controller: ReadableStreamDefaultController<Uint8Array>;
  } {
    const encoder = new TextEncoder();
    const stream = new TransformStream<Uint8Array, Uint8Array>();
    const writer = stream.writable.getWriter();
    const controller = stream.readable.getReader();

    return {
      stream: stream.readable,
      writer: stream.writable.getWriter(),
      controller: stream.readable.getReader() as unknown as ReadableStreamDefaultController<Uint8Array>,
    };
  }

  protected async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeoutMs: number
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  protected parseSseLines(text: string): Array<{ event: string | null; data: string | null }> {
    const lines = text.split('\n');
    const events: Array<{ event: string | null; data: string | null }> = [];
    let currentEvent: string | null = null;
    let currentData: string | null = null;

    for (const line of lines) {
      if (line.startsWith('event:')) {
        currentEvent = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        currentData = line.slice(5).trim();
      } else if (line === '' || line.startsWith(':')) {
        if (currentData !== null) {
          events.push({ event: currentEvent, data: currentData });
          currentEvent = null;
          currentData = null;
        }
      }
    }

    if (currentData !== null) {
      events.push({ event: currentEvent, data: currentData });
    }

    return events;
  }

  protected formatSseChunk(data: unknown): string {
    const json = JSON.stringify(data);
    return `data: ${json}\n\n`;
  }
}
