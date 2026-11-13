import { supabase } from "../../lib/supabase/client";

export interface ToolkitStatus {
  toolkit: "gmail" | "googledrive" | "github";
  label: string;
  connected: boolean;
  updatedAt: string | null;
}

interface IntegrationResponse {
  error?: string;
  redirect_url?: string;
  toolkits?: Record<string, { connected?: boolean; status?: string | null; updated_at?: string | null }>;
}

const TOOLKIT_LABELS: Record<ToolkitStatus["toolkit"], string> = {
  gmail: "Gmail",
  googledrive: "Google Drive",
  github: "GitHub",
};

async function callIntegration(body: Record<string, unknown>): Promise<IntegrationResponse> {
  const { data, error } = await supabase.functions.invoke("composito-integration", { body });
  if (error) {
    const context = (error as { context?: { status?: number } }).context;
    if (context?.status === 401) throw new Error("سجّل الدخول مجددًا لإدارة التطبيقات المرتبطة.");
    if (typeof context?.status === "number" && context.status >= 500) throw new Error("تعذّر الوصول إلى خدمة التطبيقات المرتبطة. حاول لاحقًا.");
    throw new Error("تعذّر تنفيذ العملية. تحقق من الاتصال وحاول مجددًا.");
  }
  const payload = (data ?? {}) as IntegrationResponse;
  if (payload.error) throw new Error("تعذّر تنفيذ العملية. تحقق من الاتصال وحاول مجددًا.");
  return payload;
}

export const integrationService = {
  async getStatus(): Promise<ToolkitStatus[]> {
    const payload = await callIntegration({ action: "status" });
    const toolkits = payload.toolkits ?? {};
    return (Object.keys(TOOLKIT_LABELS) as ToolkitStatus["toolkit"][]).map((toolkit) => {
      const entry = toolkits[toolkit] ?? {};
      return {
        toolkit,
        label: TOOLKIT_LABELS[toolkit],
        connected: entry.connected === true,
        updatedAt: typeof entry.updated_at === "string" ? entry.updated_at : null,
      };
    });
  },

  async openConnectFlow(toolkit: ToolkitStatus["toolkit"]): Promise<boolean> {
    const payload = await callIntegration({ action: "connect", toolkit });
    if (!payload.redirect_url) return false;
    const WebBrowser = await import("expo-web-browser");
    const result = await WebBrowser.openAuthSessionAsync(payload.redirect_url, "suly-agent-ai://auth/callback");
    await WebBrowser.dismissBrowser();
    return result.type === "success" || result.type === "locked";
  },
};
