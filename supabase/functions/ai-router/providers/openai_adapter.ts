import { BaseProvider } from '../base_provider.ts';
import { ProviderConfig, HealthCheckResult, StreamResult } from '../types.ts';

export class OpenAIAdapter extends BaseProvider {
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
      throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
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
      provider: 'openai',
      totalTokens: 0,
    };
  }

  async getModels(): Promise<Array<{ name: string; displayName: string; maxTokens: number }>>> {
    return [
      { name: 'gpt-4o', displayName: 'GPT-4o', maxTokens: 128000 },
      { name: 'gpt-4o-mini', displayName: 'GPT-4o Mini', maxTokens: 128000 },
      { name: 'gpt-3.5-turbo', displayName: 'GPT-3.5 Turbo', maxTokens: 16384 },
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
      return { provider: 'openai', model: this.config.model, healthy: true, responseTimeMs: Date.now() - start, error: null };
    } catch (err) {
      return { provider: 'openai', model: this.config.model, healthy: false, responseTimeMs: Date.now() - start, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
