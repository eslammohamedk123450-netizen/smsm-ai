import { BaseProvider } from '../base_provider.ts';
import { ProviderConfig, HealthCheckResult, StreamResult } from '../types.ts';

export class GroqAdapter extends BaseProvider {
  async chatStream(messages: Array<{ role: string; content: string }>): Promise<StreamResult> {
    const url = `${this.config.baseUrl}/chat/completions`;
    const encoder = new TextEncoder();

    const response = await this.fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.model,
          messages,
          stream: true,
          temperature: this.config.temperature ?? 0.7,
          max_tokens: this.config.max_tokens,
        }),
      },
      this.config.timeoutMs
    );

    if (!response.ok || !response.body) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Groq API error: ${response.status} ${errorText}`);
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
              if (data === '[DONE]') {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk: '', done: true })}\n\n`));
              } else {
                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices?.[0]?.delta?.content ?? '';
                  if (content) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk: content, done: false })}\n\n`));
                  }
                } catch {
                  // skip unparseable lines
                }
              }
            }
          }
        },
      })
    );

    return {
      stream: stream as unknown as ReadableStream<Uint8Array>,
      model: this.config.model,
      provider: 'groq',
      totalTokens: 0,
    };
  }

  async getModels(): Promise<Array<{ name: string; displayName: string; maxTokens: number }>>> {
    return [
      { name: 'llama-3.1-70b-versatile', displayName: 'Llama 3.1 70B', maxTokens: 131072 },
      { name: 'llama-3.1-8b-instant', displayName: 'Llama 3.1 8B', maxTokens: 131072 },
      { name: 'mixtral-8x7b-32768', displayName: 'Mixtral 8x7B', maxTokens: 32768 },
    ];
  }

  async checkHealth(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      await this.fetchWithTimeout(
        `${this.config.baseUrl}/models`,
        {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${this.config.apiKey}` },
        },
        10000
      );
      return { provider: 'groq', model: this.config.model, healthy: true, responseTimeMs: Date.now() - start, error: null };
    } catch (err) {
      return { provider: 'groq', model: this.config.model, healthy: false, responseTimeMs: Date.now() - start, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
