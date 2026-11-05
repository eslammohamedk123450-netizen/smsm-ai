export type ModelCategory = 'free' | 'premium';
export type ModelStatus = 'active' | 'suspended' | 'disabled';
export type FailureType = 'timeout' | 'network_error' | 'http_error' | 'rate_limit' | 'auth_error';

export interface AiModel {
  id: string;
  provider: string;
  model_name: string;
  display_name: string;
  category: ModelCategory;
  status: ModelStatus;
  cost_per_1k_tokens: number;
  credit_multiplier: number;
  max_tokens: number;
  supports_streaming: boolean;
  is_racing_enabled: boolean;
  endpoint_url: string | null;
}

export interface ChatRequest {
  message: string;
  model_id: string;
  conversation_id: string | null;
  stream: boolean;
  temperature?: number;
  max_tokens?: number;
  user_id: string;
}

export interface ChatResponseChunk {
  chunk: string;
  done: boolean;
  model?: string;
  provider?: string;
  token_count?: number;
  error?: string;
}

export interface ProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature?: number;
  max_tokens?: number;
  timeoutMs: number;
}

export interface StreamResult {
  stream: ReadableStream<Uint8Array>;
  model: string;
  provider: string;
  totalTokens: number;
}

export interface RacingResult {
  winner: StreamResult;
  losers: Array<{ provider: string; model: string; reason: string }>;
}

export interface HealthCheckResult {
  provider: string;
  model: string;
  healthy: boolean;
  responseTimeMs: number;
  error: string | null;
}
