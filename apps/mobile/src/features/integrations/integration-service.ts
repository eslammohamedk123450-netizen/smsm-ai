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
  error_code?: string;
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

function friendlyIntegrationError(message: string, status?: number): string {
  if (status === 401 || /authentication required|jwt|session/i.test(message)) {
    return "انتهت جلسة الدخول. سجّل الدخول مجددًا ثم أعد المحاولة.";
  }
  if (/not configured|configuration is incomplete/i.test(message)) {
    return "خدمة التطبيقات المرتبطة غير مهيأة على الخادم. أضف إعداد Composio ثم أعد المحاولة.";
  }
  if (/not active|not connected|no active/i.test(message)) {
    return "الحساب غير نشط أو لم يعد مرتبطًا. حدّث الحالة أو أعد ربط التطبيق.";
  }
  if (/disabled/i.test(message)) {
    return "الحساب مرتبط لكنه معطّل لدى مزود الخدمة. أعد تفعيل الحساب ثم حدّث الحالة.";
  }
  if (/HTTP 401|HTTP 403/i.test(message)) {
    return "رفض مزود الخدمة الطلب. أعد ربط التطبيق لتجديد الصلاحيات.";
  }
  if (/HTTP 404/i.test(message)) {
    return "لم يعثر مزود الخدمة على الحساب المرتبط. حدّث الحالة ثم أعد الربط.";
  }
  if (/HTTP 5\d\d|timed out|timeout|network|fetch/i.test(message)) {
    return "تعذّر الوصول إلى خدمة التطبيقات المرتبطة حاليًا. حاول مرة أخرى لاحقًا.";
  }
  return message && !/connected-apps service could not complete/i.test(message)
    ? message
    : "تعذّر تنفيذ العملية في خدمة التطبيقات المرتبطة. حاول مرة أخرى لاحقًا.";
}

async function callIntegration(body: Record<string, unknown>): Promise<IntegrationResponse> {
  const { data, error } = await supabase.functions.invoke("composito-integration", { body });
  let payload = (data ?? {}) as IntegrationResponse;
  if (error) {
    const context = (error as { context?: { status?: number; response?: Response } }).context;
    if (!payload.error && context?.response) {
      try {
        const responseBody = await context.response.clone().json() as unknown;
        if (responseBody && typeof responseBody === "object") payload = responseBody as IntegrationResponse;
      } catch {
        // Keep the status-based fallback below when the function returned no JSON.
      }
    }
    if (context?.status === 401) throw new Error("سجّل الدخول مجددًا لإدارة التطبيقات المرتبطة.");
    if (payload.error) throw new Error(friendlyIntegrationError(payload.error, context?.status));
    if (typeof context?.status === "number" && context.status >= 500) throw new Error("تعذّر الوصول إلى خدمة التطبيقات المرتبطة حاليًا. حاول لاحقًا.");
    throw new Error(friendlyIntegrationError(error.message || "", context?.status));
  }
  if (payload.error) throw new Error(friendlyIntegrationError(payload.error));
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
