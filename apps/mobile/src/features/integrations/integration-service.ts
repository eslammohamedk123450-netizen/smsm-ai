import { supabase } from "../../lib/supabase/client";

export interface ToolkitStatus {
  toolkit: "gmail" | "googledrive" | "github";
  label: string;
  accountId: string | null;
  connected: boolean;
  accountExists: boolean;
  disabled: boolean;
  updatedAt: string | null;
}

export type ConnectorPreflight = {
  required: boolean;
  toolkit?: ToolkitStatus["toolkit"];
  intent?: "read" | "write";
  connected?: boolean;
  accountExists?: boolean;
  disabled?: boolean;
};

interface IntegrationResponse {
  error?: string;
  redirect_url?: string;
  service_ready?: boolean;
  toolkit?: ToolkitStatus["toolkit"];
  intent?: "read" | "write";
  required?: boolean;
  connected?: boolean;
  account_exists?: boolean;
  disabled?: boolean;
  disconnected?: boolean;
  toolkits?: Record<string, { id?: string | null; connected?: boolean; is_disabled?: boolean; status?: string | null; updated_at?: string | null }>;
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
  async getStatus(): Promise<{ toolkits: ToolkitStatus[]; serviceReady: boolean }> {
    const payload = await callIntegration({ action: "status" });
    const toolkits = payload.toolkits ?? {};
    return {
      serviceReady: payload.service_ready === true,
      toolkits: (Object.keys(TOOLKIT_LABELS) as ToolkitStatus["toolkit"][]).map((toolkit) => {
        const entry = toolkits[toolkit] ?? {};
        return {
          toolkit,
          label: TOOLKIT_LABELS[toolkit],
          accountId: typeof entry.id === "string" ? entry.id : null,
          connected: entry.connected === true,
          accountExists: typeof entry.status === "string" || entry.is_disabled === true,
          disabled: entry.is_disabled === true,
          updatedAt: typeof entry.updated_at === "string" ? entry.updated_at : null,
        };
      }),
    };
  },

  async preflight(task: string): Promise<ConnectorPreflight> {
    const payload = await callIntegration({ action: "preflight", task });
    return {
      required: payload.required === true,
      toolkit: payload.toolkit,
      intent: payload.intent,
      connected: payload.connected === true,
      accountExists: payload.account_exists === true,
      disabled: payload.disabled === true,
    };
  },

  async openConnectFlow(toolkit: ToolkitStatus["toolkit"]): Promise<boolean> {
    const payload = await callIntegration({ action: "connect", toolkit });
    if (!payload.redirect_url) return false;
    const WebBrowser = await import("expo-web-browser");
    const result = await WebBrowser.openAuthSessionAsync(payload.redirect_url, "suly-agent-ai://auth/callback");
    await WebBrowser.dismissBrowser();
    return result.type === "success" || result.type === "locked";
  },

  async disconnect(toolkit: ToolkitStatus["toolkit"], accountId: string): Promise<void> {
    const payload = await callIntegration({ action: "disconnect", toolkit, account_id: accountId });
    if (payload.disconnected !== true) throw new Error("لم يؤكد الخادم قطع اتصال التطبيق.");
  },
};
