import { BaseProvider } from '../base_provider.ts';
import { ProviderConfig, HealthCheckResult, StreamResult } from '../types.ts';

export class GoogleAIAdapter extends BaseProvider {
  async chatStream(messages: Array<{ role: string; content: string }>): Promise<StreamResult> {
    const url = `${this.config.baseUrl}/models/${this.config.model}:streamGenerateContent?key=${this.config.apiKey}`;
    const encoder = new TextEncoder();

    const geminiMessages = messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : m.role === 'system' ? 'user' : 'user',
      parts: [{ text: m.content }],
    }));

    const response = await this.fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: geminiMessages,
          generationConfig: {
            temperature: this.config.temperature ?? 0.7,
            maxOutputTokens: this.config.max_tokens,
          },
        }),
      },
      this.config.timeoutMs
    );

    if (!response.ok || !response.body) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Google AI API error: ${response.status} ${errorText}`);
    }

    const stream = response.body.pipeThrough(
      new TextDecoderStream()
    ).pipeThrough(
      new TransformStream<string, Uint8Array>({
        transform(chunk, controller) {
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              try {
                const parsed = JSON.parse(data);
                const candidates = parsed.candidates ?? [];
                for (const candidate of candidates) {
                  const content = candidate.content?.parts?.[0]?.text ?? '';
                  if (content) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk: content, done: false })}\n\n`));
                  }
                }
              } catch {
                // skip unparseable lines
              }
            }
          }
        },
      })
    );

    return {
      stream: stream as unknown as ReadableStream<Uint8Array>,
      model: this.config.model,
      provider: 'google_ai',
      totalTokens: 0,
    };
  }

  async getModels(): Promise<Array<{ name: string; displayName: string; maxTokens: number }>>> {
    return [
      { name: 'gemini-1.5-pro', displayName: 'Gemini 1.5 Pro', maxTokens: 1048576 },
      { name: 'gemini-1.5-flash', displayName: 'Gemini 1.5 Flash', maxTokens: 1048576 },
      { name: 'gemini-pro', displayName: 'Gemini Pro', maxTokens: 32768 },
    ];
  }

  async checkHealth(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      await this.fetchWithTimeout(
        `${this.config.baseUrl}/models?key=${this.config.apiKey}`,
        { method: 'GET' },
        10000
      );
      return { provider: 'google_ai', model: this.config.model, healthy: true, responseTimeMs: Date.now() - start, error: null };
    } catch (err) {
      return { provider: 'google_ai', model: this.config.model, healthy: false, responseTimeMs: Date.now() - start, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
