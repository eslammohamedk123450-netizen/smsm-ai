import { BaseProvider } from '../base_provider.ts';
import { ProviderConfig, HealthCheckResult, StreamResult } from '../types.ts';

export class CohereAdapter extends BaseProvider {
  async chatStream(messages: Array<{ role: string; content: string }>): Promise<StreamResult> {
    const url = `${this.config.baseUrl}/v1/chat`;
    const encoder = new TextEncoder();

    const chatHistory = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role === 'assistant' ? 'CHATBOT' : 'USER', message: m.content }));

    const preamble = messages.find((m) => m.role === 'system')?.content ?? '';

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
          message: chatHistory.pop()?.message ?? '',
          chat_history: chatHistory,
          preamble,
          temperature: this.config.temperature ?? 0.7,
          max_tokens: this.config.max_tokens,
          stream: true,
        }),
      },
      this.config.timeoutMs
    );

    if (!response.ok || !response.body) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Cohere API error: ${response.status} ${errorText}`);
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
                const content = parsed.text ?? '';
                if (content) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk: content, done: false })}\n\n`));
                }
                if (parsed.finish_reason) {
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
      provider: 'cohere',
      totalTokens: 0,
    };
  }

  async getModels(): Promise<Array<{ name: string; displayName: string; maxTokens: number }>>> {
    return [
      { name: 'command-r-plus', displayName: 'Command R+', maxTokens: 128000 },
      { name: 'command-r', displayName: 'Command R', maxTokens: 128000 },
    ];
  }

  async checkHealth(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      await this.fetchWithTimeout(
        `${this.config.baseUrl}/v1/models`,
        {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${this.config.apiKey}` },
        },
        10000
      );
      return { provider: 'cohere', model: this.config.model, healthy: true, responseTimeMs: Date.now() - start, error: null };
    } catch (err) {
      return { provider: 'cohere', model: this.config.model, healthy: false, responseTimeMs: Date.now() - start, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
