// supabase/functions/ai-router/agent/executor.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN") ?? "";
const GMAIL_TOKEN = Deno.env.get("GMAIL_TOKEN") ?? "";
const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN") ?? "";
const WHATSAPP_PHONE_ID = Deno.env.get("WHATSAPP_PHONE_ID") ?? "";
const GOOGLE_CALENDAR_TOKEN = Deno.env.get("GOOGLE_CALENDAR_TOKEN") ?? "";
const FINANCIAL_API_KEY = Deno.env.get("FINANCIAL_API_KEY") ?? "";
const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY") ?? "";

async function logExecution(tool: string, args: any, result: any, status: string, latency: number, userId?: string) {
  try {
    await supabase.from("tool_execution_logs").insert({
      tool_name: tool, args, result, status, latency_ms: latency, user_id: userId ?? null,
      created_at: new Date().toISOString(),
    });
  } catch (e) { console.error("logExecution failed", e); }
}

export async function executeTool(name: string, args: any, userId?: string): Promise<any> {
  const start = Date.now();
  let result: any;
  let status = "success";
  try {
    switch (name) {
      case "web_search": result = await webSearch(args.query); break;
      case "github_manager": result = await githubManager(args); break;
      case "gmail_actions": result = await gmailActions(args); break;
      case "whatsapp_manager": result = await whatsappManager(args); break;
      case "calendar_manager": result = await calendarManager(args); break;
      case "financial_analyzer": result = await financialAnalyzer(args); break;
      default: throw new Error(`Unknown tool: ${name}`);
    }
  } catch (err: any) {
    status = "error";
    result = { error: err?.message ?? String(err) };
  } finally {
    await logExecution(name, args, result, status, Date.now() - start, userId);
  }
  if (status === "error") throw new Error(result.error);
  return result;
}

export function toToolResultMessage(toolCallId: string, result: any) {
  return { role: "tool", tool_call_id: toolCallId, content: JSON.stringify(result) };
}

async function webSearch(query: string) {
  if (TAVILY_API_KEY) {
    const res = await fetch("https://api.tavily.com/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ api_key: TAVILY_API_KEY, query, max_results: 5 }) });
    if (!res.ok) throw new Error(`Tavily error: ${res.status} ${await res.text()}`);
    const data = await res.json();
    return { results: data.results ?? [], query };
  }
  const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, { headers: { "User-Agent": "Mozilla/5.0" } });
  const html = await res.text();
  const matches = [...html.matchAll(/<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/g)];
  const results = matches.slice(0, 5).map((m) => ({ url: m[1], title: m[2].replace(/<[^>]+>/g, "") }));
  return { results, query, source: "duckduckgo" };
}




async function githubManager(args: any) {
  const headers = { Authorization: `Bearer ${GITHUB_TOKEN}`, "Content-Type": "application/json", "User-Agent": "smsm-ai" };
  switch (args.action) {
    case "create_repo": {
      const res = await fetch("https://api.github.com/user/repos", { method: "POST", headers, body: JSON.stringify({ name: args.repo, private: true }) });
      if (!res.ok) throw new Error(`GitHub create_repo: ${res.status} ${await res.text()}`);
      return await res.json();
    }
    case "commit_file": {
      const { repo, path, content, message = "commit from smsm-ai" } = args;
      const res = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, { method: "PUT", headers, body: JSON.stringify({ message, content: btoa(content ?? "") }) });
      if (!res.ok) throw new Error(`GitHub commit_file: ${res.status} ${await res.text()}`);
      return await res.json();
    }
    case "create_pull_request": {
      const { repo, title, body, head, base = "main" } = args;
      const res = await fetch(`https://api.github.com/repos/${repo}/pulls`, { method: "POST", headers, body: JSON.stringify({ title, body, head, base }) });
      if (!res.ok) throw new Error(`GitHub create_pr: ${res.status} ${await res.text()}`);
      return await res.json();
    }
    default: throw new Error(`Unknown github action: ${args.action}`);
  }
}

async function gmailActions(args: any) {
  const headers = { Authorization: `Bearer ${GMAIL_TOKEN}`, "Content-Type": "application/json" };
  switch (args.action) {
    case "send_email": {
      const raw = btoa(`To: ${args.to}\r\nSubject: ${args.subject}\r\n\r\n${args.body}`).replace(/\+/g, "-").replace(/\//g, "_");
      const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", { method: "POST", headers, body: JSON.stringify({ raw }) });
      if (!res.ok) throw new Error(`Gmail send: ${res.status} ${await res.text()}`);
      return await res.json();
    }
    case "list_unread": {
      const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread", { headers });
      if (!res.ok) throw new Error(`Gmail list: ${res.status} ${await res.text()}`);
      return await res.json();
    }
    case "reply": {
      const raw = btoa(`In-Reply-To: ${args.message_id}\r\n\r\n${args.reply_body}`).replace(/\+/g, "-").replace(/\//g, "_");
      const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", { method: "POST", headers, body: JSON.stringify({ raw, threadId: args.message_id }) });
      if (!res.ok) throw new Error(`Gmail reply: ${res.status} ${await res.text()}`);
      return await res.json();
    }
    default: throw new Error(`Unknown gmail action: ${args.action}`);
  }
}

async function whatsappManager(args: any) {
  const headers = { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" };
  switch (args.action) {
    case "send_template": {
      const res = await fetch(`https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_ID}/messages`, {
        method: "POST", headers,
        body: JSON.stringify({ messaging_product: "whatsapp", to: args.to, type: "template", template: { name: args.template_name, language: { code: "en_US" }, components: [{ type: "body", parameters: (args.params ?? []).map((p: string) => ({ type: "text", text: p })) }] } }),
      });
      if (!res.ok) throw new Error(`WhatsApp send: ${res.status} ${await res.text()}`);
      return await res.json();
    }
    case "get_history":
      return { phone: args.phone, messages: [], note: "history not available via Cloud API" };
    default: throw new Error(`Unknown whatsapp action: ${args.action}`);
  }
}

async function calendarManager(args: any) {
  const headers = { Authorization: `Bearer ${GOOGLE_CALENDAR_TOKEN}`, "Content-Type": "application/json" };
  switch (args.action) {
    case "schedule_meeting": {
      const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", { method: "POST", headers, body: JSON.stringify({ summary: args.summary, start: { dateTime: args.start }, end: { dateTime: args.end }, attendees: (args.attendees ?? []).map((e: string) => ({ email: e })) }) });
      if (!res.ok) throw new Error(`Calendar create: ${res.status} ${await res.text()}`);
      return await res.json();
    }
    case "list_events": {
      const params = new URLSearchParams({ timeMin: args.time_min, timeMax: args.time_max, singleEvents: "true" });
      const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, { headers });
      if (!res.ok) throw new Error(`Calendar list: ${res.status} ${await res.text()}`);
      return await res.json();
    }
    default: throw new Error(`Unknown calendar action: ${args.action}`);
  }
}

async function financialAnalyzer(args: any) {
  switch (args.action) {
    case "get_stock_price": {
      const res = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${args.symbol}&apikey=${FINANCIAL_API_KEY}`);
      if (!res.ok) throw new Error(`Stock API: ${res.status}`);
      return await res.json();
    }
    case "analyze_crypto": {
      const res = await fetch(`https://api.coingecko.com/api/v3/coins/${args.coin}`);
      if (!res.ok) throw new Error(`Crypto API: ${res.status}`);
      const data = await res.json();
      return { id: data.id, symbol: data.symbol, market_data: data.market_data };
    }
    default: throw new Error(`Unknown financial action: ${args.action}`);
  }
}
