// supabase/functions/ai-router/agent/executor.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

export async function executeTool(name: string, args: any): Promise<any> {
  try {
    switch (name) {
      case "web_search":
        return await webSearch(args.query);
      case "code_interpreter":
        return await codeInterpreter(args.language, args.code);
      case "file_manager":
        return await fileManager(args.action, args.path, args.content);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (err: any) {
    return { error: err?.message ?? String(err), tool: name };
  }
}

async function webSearch(query: string) {
  if (TAVILY_API_KEY) {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: TAVILY_API_KEY, query, max_results: 5 }),
    });
    if (!res.ok) throw new Error(`Tavily error: ${res.status} ${await res.text()}`);
    const data = await res.json();
    return { results: data.results ?? [], query };
  }
  // Fallback: DuckDuckGo HTML (no API key)
  const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  const html = await res.text();
  const matches = [...html.matchAll(/<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/g)];
  const results = matches.slice(0, 5).map((m) => ({ url: m[1], title: m[2].replace(/<[^>]+>/g, "") }));
  return { results, query, source: "duckduckgo" };
}

async function codeInterpreter(language: string, code: string) {
  if (language !== "python") throw new Error(`Unsupported language: ${language}`);
  const tmp = await Deno.makeTempFile({ suffix: ".py" });
  await Deno.writeTextFile(tmp, code);
  const proc = new Deno.Command("python3", { args: [tmp], stdout: "piped", stderr: "piped" });
  const { code: exitCode, stdout, stderr } = await proc.output();
  await Deno.remove(tmp).catch(() => {});
  return {
    exit_code: exitCode,
    stdout: new TextDecoder().decode(stdout),
    stderr: new TextDecoder().decode(stderr),
  };
}

async function fileManager(action: string, path: string, content?: string) {
  const [bucket, ...rest] = path.split("/");
  const objectPath = rest.join("/");
  switch (action) {
    case "read": {
      const { data, error } = await supabase.storage.from(bucket).download(objectPath);
      if (error) throw error;
      const text = await data.text();
      return { content: text, path };
    }
    case "write": {
      const { error } = await supabase.storage.from(bucket).upload(objectPath, new Blob([content ?? ""], { type: "text/plain" }), { upsert: true });
      if (error) throw error;
      return { success: true, path };
    }
    case "delete": {
      const { error } = await supabase.storage.from(bucket).remove([objectPath]);
      if (error) throw error;
      return { success: true, path };
    }
    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

export function toToolResultMessage(toolCallId: string, result: any) {
  return {
    role: "tool",
    tool_call_id: toolCallId,
    content: JSON.stringify(result),
  };
}
