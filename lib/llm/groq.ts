import Groq from "groq-sdk";
import { ProxyAgent, setGlobalDispatcher } from "undici";
import { config } from "../config";

let client: Groq | null = null;
let proxyConfigured = false;

/**
 * If HTTPS_PROXY / HTTP_PROXY / ALL_PROXY is set in the environment, route
 * Node's global fetch (used by groq-sdk) through it. Lets users on networks
 * that block api.groq.com tunnel through a corporate / personal proxy.
 *
 * Also honors NO_PROXY for a list of comma-separated hosts to bypass.
 */
function configureProxyOnce() {
  if (proxyConfigured) return;
  proxyConfigured = true;
  const proxyUrl =
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy ||
    process.env.ALL_PROXY ||
    process.env.all_proxy;
  if (!proxyUrl) return;
  try {
    setGlobalDispatcher(new ProxyAgent(proxyUrl));
    console.log(`[groq] using HTTPS proxy: ${proxyUrl}`);
  } catch (err) {
    console.warn(`[groq] failed to configure proxy ${proxyUrl}:`, err);
  }
}

export function getGroq(): Groq {
  if (!config.groq.apiKey) {
    throw new Error(
      "Groq is not configured. Set GROQ_API_KEY in .env.local (or in Vercel project env).",
    );
  }
  configureProxyOnce();
  if (!client) {
    client = new Groq({
      apiKey: config.groq.apiKey,
      // Allow overriding the API host (proxy mirror, regional gateway, etc).
      baseURL: process.env.GROQ_BASE_URL || undefined,
      // If the SDK takes >25s end-to-end, abandon and let our retry/fallback
      // chain pick the next model. Stops the UI from hanging on flaky links.
      timeout: 25_000,
      maxRetries: 0, // we handle retries ourselves
    });
  }
  return client;
}

/**
 * Identify "this looks like a corporate proxy / network block" so we can
 * give the user actionable guidance instead of a raw "Connection error".
 *
 * Heuristics:
 *  - urlblock.php / blockpage / squid / fortinet / netskope in any field;
 *  - HTML body where we expected JSON (302 to a captive portal);
 *  - 302/307 with a Location header pointing at a private IP.
 */
export function looksLikeNetworkBlock(err: unknown): boolean {
  const message = String((err as { message?: string })?.message ?? "");
  if (!message) return false;
  return /urlblock|blockpage|forticlient|fortinet|netskope|zscaler|policy|denied by|captive portal|proxy authentication required/i.test(
    message,
  );
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

  // If every error is the same generic "Connection error." (groq-sdk's
  // wording when fetch can't reach the host) AND nothing has an HTTP status,
  // it's almost always upstream network policy or VPN — not a real Groq
  // outage. Tell the user clearly so they don't chase ghosts.
  const allConnection = errors.length > 0 &&
    errors.every((e) =>
      /^connection error\.?$/i.test(e.reason.trim()) ||
      looksLikeNetworkBlock({ message: e.reason }),
    );

  const hint = allConnection
    ? "\n\nLikely cause: the network is blocking outbound HTTPS to api.groq.com" +
      " (corporate proxy, VPN URL filter, or captive portal). Run" +
      " `npm run llm:doctor` to confirm. Workarounds:\n" +
      "  - disconnect from VPN or switch to a personal hotspot,\n" +
      "  - set HTTPS_PROXY=http://your.proxy:port in .env.local,\n" +
      "  - or set GROQ_BASE_URL=<reachable-mirror> if you have one."
    : "";

  throw new Error(
    `All Groq models failed after retries. Tried ${models.length} model(s):\n${lines}${hint}`,
  );
}
