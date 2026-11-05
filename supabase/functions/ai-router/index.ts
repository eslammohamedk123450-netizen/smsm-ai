import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { corsHeaders, handleCorsRequest } from '../_shared/cors.ts';
import { verifyUserToken, getSupabaseAdmin, getEncryptedApiKey } from '../_shared/supabase_admin.ts';
import { CircuitBreaker } from './circuit_breaker.ts';
import { RacingEngine } from './racing_engine.ts';
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
import { AiModel } from './types.ts';

const PROVIDER_CONSTRUCTORS: Record<string, new (config: any) => any> = {
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

serve(async (req: Request) => {
  const corsResponse = handleCorsRequest(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing or invalid authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const jwt = authHeader.slice(7);
    const user = await verifyUserToken(jwt);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token, or user is banned' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { userId } = user;
    const supabase = getSupabaseAdmin();
    const body = await req.json();
    const { message, model_id, conversation_id, stream = true, temperature = 0.7, max_tokens } = body;

    if (!message || typeof message !== 'string') {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!model_id) {
      return new Response(JSON.stringify({ error: 'Model ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const promptTokens = Math.ceil(message.length / 4);
    if (promptTokens > 32000) {
      return new Response(JSON.stringify({ error: 'Prompt exceeds 32k token limit' }), {
        status: 413,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: model, error: modelError } = await supabase
      .from('ai_models')
      .select('*')
      .eq('id', model_id)
      .single();

    if (modelError || !model) {
      return new Response(JSON.stringify({ error: 'Model not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiModel: AiModel = {
      id: model.id,
      provider: model.provider,
      model_name: model.model_name,
      display_name: model.display_name,
      category: model.category,
      status: model.status,
      cost_per_1k_tokens: model.cost_per_1k_tokens,
      credit_multiplier: model.credit_multiplier,
      max_tokens: model.max_tokens,
      supports_streaming: model.supports_streaming,
      is_racing_enabled: model.is_racing_enabled,
      endpoint_url: model.endpoint_url,
    };

    if (aiModel.status === 'suspended' || aiModel.status === 'disabled') {
      return new Response(JSON.stringify({ error: `Model is ${aiModel.status}` }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('credit_balance, is_banned')
      .eq('id', userId)
      .single();

    if (profile?.is_banned) {
      return new Response(JSON.stringify({ error: 'User account is banned' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const messages = [{ role: 'user', content: message }];

    if (aiModel.category === 'free' && aiModel.is_racing_enabled) {
      const models = [aiModel];
      try {
        const racingResult = await RacingEngine.raceFreeModels(models, messages, 8000);
        const { stream: winningStream, model: winnerModel, provider: winnerProvider } = racingResult.winner;

        const encoder = new TextEncoder();
        const sseStream = new TransformStream<Uint8Array, Uint8Array>();
        const writer = sseStream.writable.getWriter();

        const pump = (async () => {
          const reader = winningStream.getReader();
          let fullContent = '';
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const text = new TextDecoder().decode(value);
              fullContent += text;
              await writer.write(encoder.encode(text));
            }
            await writer.write(encoder.encode(`data: ${JSON.stringify({ chunk: '', done: true, model: winnerModel, provider: winnerProvider })}\n\n`));
          } catch (err) {
            await CircuitBreaker.recordFailure(
              aiModel.id,
              aiModel.provider,
              aiModel.model_name,
              'stream_error',
              err instanceof Error ? err.message : String(err),
            );
            await writer.write(encoder.encode(`data: ${JSON.stringify({ error: 'Stream interrupted' })}\n\n`));
          } finally {
            await writer.close();
            const completionTokens = Math.ceil(fullContent.length / 4);
            const totalTokens = promptTokens + completionTokens;
            const cost = Math.ceil((totalTokens / 1000) * aiModel.cost_per_1k_tokens * aiModel.credit_multiplier);
            if (cost > 0) {
              await supabase.rpc('deduct_user_credits', {
                p_user_id: userId,
                p_total_tokens: totalTokens,
                p_cost: cost,
                p_source: 'chat',
                p_reference_id: null,
              }).catch((err) => console.error('Credit deduction failed:', err));
            }
          }
        })();

        return new Response(sseStream.readable, {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
        });
      } catch (err) {
        await CircuitBreaker.recordFailure(
          aiModel.id,
          aiModel.provider,
          aiModel.model_name,
          'racing_error',
          err instanceof Error ? err.message : String(err),
        );
        return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const apiKey = await getEncryptedApiKey(aiModel.provider);
    if (!apiKey) {
      return new Response(JSON.stringify({ error: `No API key configured for provider: ${aiModel.provider}` }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (aiModel.category === 'premium') {
      const { data: profile2 } = await supabase
        .from('profiles')
        .select('credit_balance')
        .eq('id', userId)
        .single();

      const estimatedCost = Math.ceil(((promptTokens + (max_tokens ?? 500)) / 1000) * aiModel.cost_per_1k_tokens * aiModel.credit_multiplier);
      if (!profile2 || profile2.credit_balance < estimatedCost) {
        return new Response(JSON.stringify({ error: 'Insufficient credits for this model', required: estimatedCost, current: profile2?.credit_balance ?? 0 }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const Constructor = PROVIDER_CONSTRUCTORS[aiModel.provider];
    if (!Constructor) {
      return new Response(JSON.stringify({ error: `Unsupported provider: ${aiModel.provider}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const provider = new Constructor({
      apiKey,
      baseUrl: aiModel.endpoint_url ?? 'https://api.example.com/v1',
      model: aiModel.model_name,
      temperature,
      max_tokens: max_tokens ?? aiModel.max_tokens,
      timeoutMs: 30000,
    });

    try {
      const streamResult = await provider.chatStream(messages);

      const encoder = new TextEncoder();
      const sseStream = new TransformStream<Uint8Array, Uint8Array>();
      const writer = sseStream.writable.getWriter();

      const pump = (async () => {
        const reader = streamResult.stream.getReader();
        let fullContent = '';
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const text = new TextDecoder().decode(value);
            fullContent += text;
            await writer.write(encoder.encode(text));
          }
          await writer.write(encoder.encode(`data: ${JSON.stringify({ chunk: '', done: true, model: streamResult.model, provider: streamResult.provider })}\n\n`));
        } catch (err) {
          await CircuitBreaker.recordFailure(
            aiModel.id,
            aiModel.provider,
            aiModel.model_name,
            'stream_error',
            err instanceof Error ? err.message : String(err),
          );
          await writer.write(encoder.encode(`data: ${JSON.stringify({ error: 'Stream interrupted' })}\n\n`));
        } finally {
          await writer.close();
          const completionTokens = Math.ceil(fullContent.length / 4);
          const totalTokens = promptTokens + completionTokens;
          const cost = Math.ceil((totalTokens / 1000) * aiModel.cost_per_1k_tokens * aiModel.credit_multiplier);
          if (cost > 0 && aiModel.category === 'premium') {
            await supabase.rpc('deduct_user_credits', {
              p_user_id: userId,
              p_total_tokens: totalTokens,
              p_cost: cost,
              p_source: 'chat',
              p_reference_id: null,
            }).catch((err) => console.error('Credit deduction failed:', err));
          }
        }
      })();

      return new Response(sseStream.readable, {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
      });
    } catch (err) {
      await CircuitBreaker.recordFailure(
        aiModel.id,
        aiModel.provider,
        aiModel.model_name,
        'provider_error',
        err instanceof Error ? err.message : String(err),
      );
      return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});