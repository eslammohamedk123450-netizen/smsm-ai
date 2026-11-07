import { supabase } from "../../lib/supabase/client";

export type FrictionKind = "screen_open" | "task_start" | "task_stuck" | "action_failed" | "response_stopped" | "upload_failed";
export type FrictionScreen = "chat" | "media" | "support" | "settings" | "hims" | "other";
export type FrictionFeature = "chat" | "support" | "hims" | "settings" | "general";

/** Records bounded event metadata only; never send message text, filenames, or free-form context. */
export async function logFrictionEvent(input: {
  eventKind: FrictionKind;
  screenKey: FrictionScreen;
  featureKey?: FrictionFeature;
  stepKey?: string;
  errorCode?: string;
  durationMs?: number;
  conversationId?: string | null;
}): Promise<void> {
  try {
    const { error } = await supabase.from("suly_friction_events").insert({
      event_kind: input.eventKind,
      screen_key: input.screenKey,
      feature_key: input.featureKey ?? "general",
      step_key: input.stepKey?.replace(/[^a-z0-9_]/g, "_").slice(0, 60) || null,
      error_code: input.errorCode?.replace(/[^a-z0-9_]/g, "_").slice(0, 60) || null,
      duration_ms: typeof input.durationMs === "number" ? Math.max(0, Math.min(Math.floor(input.durationMs), 3_600_000)) : null,
      conversation_id: input.conversationId ?? null,
    });
    if (error && __DEV__) console.warn("Friction event was not saved.");
  } catch {
    // Telemetry must never block the user's task.
  }
}
