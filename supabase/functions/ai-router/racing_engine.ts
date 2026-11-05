import { StreamResult, RacingResult, AiModel } from './types.ts';
import { BaseProvider } from './base_provider.ts';
import { OpenAIAdapter } from './providers/openai_adapter.ts';
import { GroqAdapter } from './providers/groq_adapter.ts';
import { GoogleAIAdapter } from './providers/google_ai_adapter.ts';
import { OpenRouterAdapter } from './providers/openrouter_adapter.ts';
import { DeepSeekAdapter } from './providers/deepseek_adapter.ts';
import { AnthropicAdapter } from './providers/anthropic_adapter.ts';
import { MistralAdapter } from './providers/mistral_adapter.ts';
import { CohereAdapter } from './providers/cohere_adapter.ts';
import { TogetherAdapter } from './providers/together_adapter.ts';
import { PerplexityAdapter } from './providers/perplexity_adapter.ts';
import { XAIAdapter } from './providers/xai_adapter.ts';
import { CustomAdapter } from './providers/custom_adapter.ts';
import { getEncryptedApiKey } from '../_shared/supabase_admin.ts';

export class RacingEngine {
  static providerConstructors: Record<string, new (config: any) => BaseProvider> = {
    openai: OpenAIAdapter,
    groq: GroqAdapter,
    google_ai: GoogleAIAdapter,
    openrouter: OpenRouterAdapter,
    deepseek: DeepSeekAdapter,
    anthropic: AnthropicAdapter,
    mistral: MistralAdapter,
    cohere: CohereAdapter,
    together: TogetherAdapter,
    perplexity: PerplexityAdapter,
    xai: XAIAdapter,
    custom: CustomAdapter,
  };

  static createProvider(provider: string, config: any): BaseProvider {
    const Constructor = this.providerConstructors[provider];
    if (!Constructor) {
      throw new Error(`Unknown provider: ${provider}`);
    }
    return new Constructor(config);
  }

  static async raceFreeModels(
    models: AiModel[],
    messages: Array<{ role: string; content: string }>,
    firstTokenTimeoutMs: number = 8000
  ): Promise<RacingResult> {
    const candidates = models.filter((m) => m.status === 'active' && m.is_racing_enabled);
    if (candidates.length === 0) {
      throw new Error('No racing-enabled free models available');
    }

    const providerConfigs = await Promise.all(
      candidates.map(async (model) => {
        const apiKey = await getEncryptedApiKey(model.provider);
        if (!apiKey) {
          return null;
        }
        return {
          model,
          config: {
            apiKey,
            baseUrl: model.endpoint_url ?? this.getDefaultBaseUrl(model.provider),
            model: model.model_name,
            temperature: 0.7,
            max_tokens: model.max_tokens,
            timeoutMs: firstTokenTimeoutMs,
          },
        };
      })
    );

    const validConfigs = providerConfigs.filter((c) => c !== null) as Array<{
      model: AiModel;
      config: any;
    }>;

    if (validConfigs.length === 0) {
      throw new Error('No API keys available for racing models');
    }

    const abortControllers: AbortController[] = [];
    const results: Array<{ provider: string; model: string; reason: string }> = [];
    let winner: StreamResult | null = null;
    let winnerLocked = false;

    const racePromises = validConfigs.map(async ({ model, config }) => {
      const ac = new AbortController();
      abortControllers.push(ac);

      try {
        const provider = RacingEngine.createProvider(model.provider, {
          ...config,
          signal: ac.signal,
        });

        const streamResult = await provider.chatStream(messages);

        if (!winnerLocked) {
          winnerLocked = true;
          winner = streamResult;

          // Abort all other competitors
          for (const controller of abortControllers) {
            controller.abort();
          }

          return { winner: streamResult, losers: results };
        }

        // We lost the race
        ac.abort();
        return null;
      } catch (err) {
        results.push({
          provider: model.provider,
          model: model.model_name,
          reason: err instanceof Error ? err.message : String(err),
        });
        return null;
      }
    });

    const raceResults = await Promise.allSettled(racePromises);

    for (const result of raceResults) {
      if (result.status === 'fulfilled' && result.value?.winner) {
        winner = result.value.winner;
        results.push(...(result.value.losers ?? []));
        break;
      }
    }

    if (!winner) {
      for (const controller of abortControllers) {
        controller.abort();
      }
      throw new Error('All racing models failed');
    }

    return {
      winner,
      losers: results,
    };
  }

  private static getDefaultBaseUrl(provider: string): string {
    const baseUrls: Record<string, string> = {
      openai: 'https://api.openai.com/v1',
      groq: 'https://api.groq.com/openai/v1',
      google_ai: 'https://generativelanguage.googleapis.com/v1beta',
      openrouter: 'https://openrouter.ai/api/v1',
      deepseek: 'https://api.deepseek.com/v1',
      anthropic: 'https://api.anthropic.com',
      mistral: 'https://api.mistral.ai/v1',
      cohere: 'https://api.cohere.ai',
      together: 'https://api.together.xyz/v1',
      perplexity: 'https://api.perplexity.ai',
      xai: 'https://api.x.ai/v1',
      custom: 'https://api.custom-provider.com/v1',
    };
    return baseUrls[provider] ?? 'https://api.example.com/v1';
  }
}
