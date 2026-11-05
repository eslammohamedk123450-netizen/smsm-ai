import { BaseProvider } from '../base_provider.ts';
import { ProviderConfig, HealthCheckResult, StreamResult } from '../types.ts';

export class MistralAdapter extends BaseProvider {
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
      throw new Error(`Mistral API error: ${response.status} ${errorText}`);
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
      provider: 'mistral',
      totalTokens: 0,
    };
  }

  async getModels(): Promise<Array<{ name: string; displayName: string; maxTokens: number }>>> {
    return [
      { name: 'mistral-large-latest', displayName: 'Mistral Large', maxTokens: 128000 },
      { name: 'mistral-medium-latest', displayName: 'Mistral Medium', maxTokens: 128000 },
      { name: 'mistral-small-latest', displayName: 'Mistral Small', maxTokens: 128000 },
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
      return { provider: 'mistral', model: this.config.model, healthy: true, responseTimeMs: Date.now() - start, error: null };
    } catch (err) {
      return { provider: 'mistral', model: this.config.model, healthy: false, responseTimeMs: Date.now() - start, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
