import { BaseProvider } from '../base_provider.ts';
import { ProviderConfig, HealthCheckResult, StreamResult } from '../types.ts';

export class AnthropicAdapter extends BaseProvider {
  async chatStream(messages: Array<{ role: string; content: string }>): Promise<StreamResult> {
    const url = `${this.config.baseUrl}/v1/messages`;
    const encoder = new TextEncoder();

    const systemMsg = messages.find((m) => m.role === 'system')?.content ?? '';
    const chatMessages = messages.filter((m) => m.role !== 'system');

    const response = await this.fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: {
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.model,
          system: systemMsg,
          messages: chatMessages.map((m) => ({ role: m.role, content: m.content })),
          stream: true,
          temperature: this.config.temperature ?? 0.7,
          max_tokens: this.config.max_tokens ?? 4096,
        }),
      },
      this.config.timeoutMs
    );

    if (!response.ok || !response.body) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Anthropic API error: ${response.status} ${errorText}`);
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
                if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
                  const content = parsed.delta.text ?? '';
                  if (content) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk: content, done: false })}\n\n`));
                  }
                }
                if (parsed.type === 'message_stop') {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk: '', done: true })}\n\n`));
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
      provider: 'anthropic',
      totalTokens: 0,
    };
  }

  async getModels(): Promise<Array<{ name: string; displayName: string; maxTokens: number }>>> {
    return [
      { name: 'claude-3-5-sonnet-20241022', displayName: 'Claude 3.5 Sonnet', maxTokens: 200000 },
      { name: 'claude-3-haiku-20240307', displayName: 'Claude 3 Haiku', maxTokens: 200000 },
    ];
  }

  async checkHealth(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      await this.fetchWithTimeout(
        `${this.config.baseUrl}/v1/messages`,
        {
          method: 'POST',
          headers: {
            'x-api-key': this.config.apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: this.config.model,
            messages: [{ role: 'user', content: 'Hello' }],
            max_tokens: 1,
          }),
        },
        10000
      );
      return { provider: 'anthropic', model: this.config.model, healthy: true, responseTimeMs: Date.now() - start, error: null };
    } catch (err) {
      return { provider: 'anthropic', model: this.config.model, healthy: false, responseTimeMs: Date.now() - start, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
