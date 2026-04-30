import Groq from "groq-sdk";
import { config } from "../config";

let client: Groq | null = null;

export function getGroq(): Groq {
  if (!config.groq.apiKey) {
    throw new Error(
      "Groq is not configured. Set GROQ_API_KEY in .env (or in Vercel project env).",
    );
  }
  if (!client) client = new Groq({ apiKey: config.groq.apiKey });
  return client;
}

export interface ChatOptions {
  system: string;
  user: string;
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
}

export async function chat(opts: ChatOptions): Promise<string> {
  const groq = getGroq();
  const res = await groq.chat.completions.create({
    model: config.groq.model,
    temperature: opts.temperature ?? 0.2,
    max_tokens: opts.maxTokens ?? 2048,
    response_format: opts.json ? { type: "json_object" } : undefined,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
  });
  return res.choices[0]?.message?.content ?? "";
}
