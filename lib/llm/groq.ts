import Groq from "groq-sdk";
import { config } from "../config";

let client: Groq | null = null;

export function getGroq(): Groq {
  if (!config.groq.apiKey) {
    throw new Error(
      "Groq is not configured. Set GROQ_API_KEY in .env.local (or in Vercel project env).",
    );
  }
  if (!client) client = new Groq({ apiKey: config.groq.apiKey });
  return client;
}

export interface ChatOptions<T = string> {
  system: string;
  user: string;
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
  /**
   * Optional validator. If supplied, its return value is what `chat()`
   * resolves with. Throwing inside the validator (e.g. JSON.parse error or
   * a Zod failure) is treated as an LLM-output failure: the runner will
   * retry the same model and then fall through to the next model in the
   * chain. Use this for "the LLM must return parseable JSON" style flows.
   */
  validate?: (raw: string) => T | Promise<T>;
}

const PER_MODEL_ATTEMPTS = 2;

interface AttemptError {
  model: string;
  attempt: number;
  reason: string;
  retryable: boolean;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * True for transient transport / rate-limit errors and generic 5xx. Used to
 * decide whether to retry the same model or move on. Validator failures are
 * treated as non-retryable on the same model (we move on immediately) since
 * a model that returned malformed JSON once tends to do it again.
 */
function isRetryableTransport(err: unknown): boolean {
  const message = (err as { message?: string })?.message ?? "";
  const status = (err as { status?: number; statusCode?: number })?.status
    ?? (err as { statusCode?: number })?.statusCode;
  if (typeof status === "number") {
    if (status === 408 || status === 409 || status === 425 || status === 429)
      return true;
    if (status >= 500 && status < 600) return true;
    return false;
  }
  // Network / fetch-level errors (no HTTP status).
  return /timeout|ECONNRESET|ETIMEDOUT|EAI_AGAIN|fetch failed|network/i.test(
    message,
  );
}

/**
 * Run an LLM call across the configured fallback chain.
 *
 * For each model:
 *   - try up to PER_MODEL_ATTEMPTS times, with exponential backoff between
 *     attempts (200ms, 600ms, ...), but only on retryable transport errors;
 *   - on a validator failure (bad JSON, schema mismatch), drop down to the
 *     next model immediately;
 *   - on a non-retryable error (e.g. 401, 400 model-not-found), drop down
 *     to the next model immediately.
 *
 * If every model in the chain fails, throws an aggregate Error whose message
 * lists each attempt for easy debugging.
 */
export async function chat<T = string>(opts: ChatOptions<T>): Promise<T> {
  const groq = getGroq();
  const models = config.groq.models;
  if (models.length === 0) {
    throw new Error(
      "No Groq models configured. Set GROQ_MODEL or GROQ_MODELS in .env.local.",
    );
  }

  const errors: AttemptError[] = [];

  for (const model of models) {
    for (let attempt = 1; attempt <= PER_MODEL_ATTEMPTS; attempt++) {
      try {
        const res = await groq.chat.completions.create({
          model,
          temperature: opts.temperature ?? 0.2,
          max_tokens: opts.maxTokens ?? 2048,
          response_format: opts.json ? { type: "json_object" } : undefined,
          messages: [
            { role: "system", content: opts.system },
            { role: "user", content: opts.user },
          ],
        });

        const raw = res.choices[0]?.message?.content ?? "";

        if (!opts.validate) {
          return raw as unknown as T;
        }

        try {
          return await opts.validate(raw);
        } catch (validatorErr) {
          // Validator throws => bad LLM output. Don't retry the same model;
          // jump straight to the next one in the chain.
          errors.push({
            model,
            attempt,
            reason: `validator: ${(validatorErr as Error).message}`,
            retryable: false,
          });
          break;
        }
      } catch (err) {
        const retryable = isRetryableTransport(err);
        errors.push({
          model,
          attempt,
          reason: (err as Error).message ?? String(err),
          retryable,
        });
        if (!retryable || attempt === PER_MODEL_ATTEMPTS) break;
        // Exponential backoff: 200ms, 600ms, 1.4s, ...
        await sleep(200 * (3 ** (attempt - 1)));
      }
    }
  }

  const lines = errors
    .map((e) => `  - ${e.model} (attempt ${e.attempt}): ${e.reason}`)
    .join("\n");
  throw new Error(
    `All Groq models failed after retries. Tried ${models.length} model(s):\n${lines}`,
  );
}
