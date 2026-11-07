import { supabase } from "../../lib/supabase/client";

// Feature activation is data-driven: the backend returns whatever features are
// registered in `suly_feature_flags`, so the client never hard-codes a feature
// name (HIMS today, something else tomorrow). Activation itself happens by
// sending `!ACTIVATE_<CODE>` in chat, which the ai-router intercepts before any
// model call, so no credits are consumed.

export interface FeatureEntry {
  key: string;
  label: string;
  activated: boolean;
}

export const ACTIVATION_HINT = "لتفعيل ميزة، أرسل كود التفعيل في المحادثة بالصيغة: !ACTIVATE_الكود";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

/** Reads the activation state of every feature for the signed-in user. */
export async function getMyFeatures(): Promise<FeatureEntry[]> {
  const { data, error } = await supabase.rpc("suly_my_feature_status");
  if (error) return [];
  const record = asRecord(data);
  return Object.entries(record).map(([key, value]) => {
    const entry = asRecord(value);
    return {
      key,
      label: typeof entry.label === "string" && entry.label.trim() ? entry.label : key,
      activated: entry.activated === true,
    };
  }).sort((a, b) => Number(b.activated) - Number(a.activated) || a.key.localeCompare(b.key));
}
