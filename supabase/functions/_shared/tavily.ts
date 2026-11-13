type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

export async function readTavilyApiKey(supabase: { rpc: Function }): Promise<string> {
  const { data, error } = await supabase.rpc("suly_service_get_tavily_api_key");
  if (error || typeof data !== "string" || data.trim().length === 0) throw new Error("Tavily is not configured on the server.");
  return data.trim();
}

export function isWebSearchRequest(text: string): boolean {
  return /\b(search|browse|web|internet|online|news|current|latest|recent|look up|research|find out)\b|ابحث|بحث|الإنترنت|الانترنت|النت|على النت|على الإنترنت|أخبار|خبر|حالي|حديث|آخر الأخبار|جوجل|معلومات عن/iu.test(text);
}

export async function runTavilySearch(apiKey: string, query: string): Promise<JsonRecord> {
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: query.trim().slice(0, 1000), search_depth: "basic", topic: "general", max_results: 5, include_answer: "advanced", include_raw_content: false }),
    redirect: "error",
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`Tavily returned HTTP ${response.status}.`);
  const body = asRecord(await response.json());
  return {
    answer: typeof body.answer === "string" ? body.answer.slice(0, 5000) : null,
    results: Array.isArray(body.results) ? body.results.slice(0, 5).map((item) => {
      const row = asRecord(item);
      return { title: row.title, url: row.url, content: typeof row.content === "string" ? row.content.slice(0, 1800) : null, published_date: row.published_date ?? null };
    }) : [],
  };
}
