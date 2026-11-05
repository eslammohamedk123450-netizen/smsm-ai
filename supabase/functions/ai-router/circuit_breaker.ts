import { getSupabaseAdmin } from '../_shared/supabase_admin.ts';

export class CircuitBreaker {
  static async recordFailure(
    modelId: string,
    provider: string,
    modelName: string,
    failureType: string,
    failureReason: string,
    responseTimeMs?: number,
    statusCode?: number
  ): Promise<{ autoSuspended: boolean; failureCount: number }> {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase.rpc('record_model_health_failure', {
      p_model_id: modelId,
      p_provider: provider,
      p_model_name: modelName,
      p_failure_type: failureType,
      p_failure_reason: failureReason,
      p_response_time_ms: responseTimeMs ?? null,
      p_status_code: statusCode ?? null,
    });

    if (error) {
      throw new Error(`Circuit breaker error: ${error.message}`);
    }

    return {
      autoSuspended: (data as any)?.auto_suspended ?? false,
      failureCount: (data as any)?.failure_count ?? 0,
    };
  }

  static async isModelSuspended(modelId: string): Promise<boolean> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('ai_models')
      .select('status')
      .eq('id', modelId)
      .single();

    if (error || !data) {
      return true;
    }

    return data.status === 'suspended' || data.status === 'disabled';
  }

  static async getFailureStats(modelId: string, windowMinutes: number = 15): Promise<{ count: number; windowMinutes: number }> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('model_health_logs')
      .select('*', { count: 'exact' })
      .eq('model_id', modelId)
      .gte('recorded_at', new Date(Date.now() - windowMinutes * 60 * 1000).toISOString());

    if (error) {
      return { count: 0, windowMinutes };
    }

    return { count: data?.length ?? 0, windowMinutes };
  }

  static async checkAndSuspendIfNeeded(
    modelId: string,
    provider: string,
    modelName: string,
    threshold: number = 3,
    windowMinutes: number = 15
  ): Promise<boolean> {
    const stats = await this.getFailureStats(modelId, windowMinutes);

    if (stats.count >= threshold) {
      const suspended = await this.isModelSuspended(modelId);
      if (!suspended) {
        const supabase = getSupabaseAdmin();
        await supabase.rpc('suspend_model', {
          p_model_id: modelId,
          p_reason: `Auto-suspended: ${stats.count} failures in ${windowMinutes} minutes`,
        });
        return true;
      }
    }

    return false;
  }
}
