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
  // Keep live-search routing explicit. Broad phrases such as "معلومات عن" or
  // "حديث" commonly appear in ordinary educational questions and should not
  // force a tool-backed Agent hop.
  return /\\b(search(?:\\s+(?:for|the web|online))?|browse|web search|internet search|online search|news|latest|recent|today|right now|look up|research|find current)\\b|ابحث|دور على|على النت|على الإنترنت|أخبار|آخر الأخبار|الأخبار|اليوم|حاليًا|الآن|مصادر متعددة|في جوجل|على جوجل/iu.test(text);
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
