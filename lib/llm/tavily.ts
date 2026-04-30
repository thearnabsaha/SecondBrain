import { config } from "../config";

/**
 * Minimal Tavily Search API client.
 * Docs: https://docs.tavily.com/docs/rest-api/api-reference
 *
 * We only use the `/search` endpoint and ask for a short LLM-generated answer
 * plus the top-N snippets. The result feeds into the LLM enrichment prompt.
 */

export interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

export interface TavilyResponse {
  answer: string | null;
  results: TavilyResult[];
}

export async function tavilySearch(
  query: string,
  opts: { maxResults?: number; includeAnswer?: boolean } = {},
): Promise<TavilyResponse> {
  if (!config.tavily.apiKey) {
    throw new Error(
      "Tavily is not configured. Set TAVILY_API_KEY in .env (or in Vercel project env).",
    );
  }
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: config.tavily.apiKey,
      query,
      search_depth: "basic",
      include_answer: opts.includeAnswer ?? true,
      max_results: opts.maxResults ?? 5,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Tavily error ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    answer?: string | null;
    results?: Array<{
      title?: string;
      url?: string;
      content?: string;
      score?: number;
    }>;
  };
  return {
    answer: data.answer ?? null,
    results: (data.results ?? []).map((r) => ({
      title: r.title ?? "",
      url: r.url ?? "",
      content: r.content ?? "",
      score: r.score ?? 0,
    })),
  };
}
