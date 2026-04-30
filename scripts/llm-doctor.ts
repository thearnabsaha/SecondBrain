/* eslint-disable no-console */
/**
 * LLM connectivity doctor.
 *
 * Tells you, in plain English, whether your machine can actually reach
 * api.groq.com right now and what to do if it can't. Use this whenever
 * `Connection error` or "All Groq models failed" shows up.
 */
import { config as loadEnv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
loadEnv({ path: path.join(root, ".env.local") });
loadEnv({ path: path.join(root, ".env") });

const HOST = "https://api.groq.com";
const PING_PATH = "/openai/v1/models";

function fmt(label: string, value: string, ok: boolean) {
  const tick = ok ? "OK " : "FAIL";
  return `  [${tick}] ${label.padEnd(28)} ${value}`;
}

async function timed<T>(fn: () => Promise<T>): Promise<{ value: T; ms: number }> {
  const t0 = Date.now();
  const value = await fn();
  return { value, ms: Date.now() - t0 };
}

async function main() {
  console.log("\nSecondBrain LLM connectivity check\n");

  // 1. env keys
  const apiKey = process.env.GROQ_API_KEY ?? "";
  const proxyUrl =
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy ||
    "";
  const baseUrl = process.env.GROQ_BASE_URL || HOST;

  console.log("Environment:");
  console.log(
    fmt(
      "GROQ_API_KEY",
      apiKey ? `set (${apiKey.slice(0, 8)}…)` : "MISSING",
      Boolean(apiKey),
    ),
  );
  console.log(fmt("GROQ_BASE_URL", baseUrl, true));
  console.log(fmt("HTTPS_PROXY", proxyUrl || "(unset)", true));
  console.log("");

  // 2. apply proxy if set, then probe
  if (proxyUrl) {
    try {
      const { ProxyAgent, setGlobalDispatcher } = await import("undici");
      setGlobalDispatcher(new ProxyAgent(proxyUrl));
      console.log(`  using proxy: ${proxyUrl}\n`);
    } catch (err) {
      console.log(`  failed to apply proxy ${proxyUrl}: ${(err as Error).message}\n`);
    }
  }

  // 3. probe with manual redirect so we can see if we're being captive-portal'd
  console.log("Probing api.groq.com:");
  let probe: { status: number; text: string; headers: Headers; ms: number };
  try {
    const r = await timed(() =>
      fetch(`${baseUrl}${PING_PATH}`, {
        method: "GET",
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
        redirect: "manual",
      }),
    );
    const text = await r.value.text().catch(() => "");
    probe = { status: r.value.status, text, headers: r.value.headers, ms: r.ms };
  } catch (err) {
    console.log(fmt("network reachable?", `NO — ${(err as Error).message}`, false));
    diagnose({ unreachable: true });
    return;
  }

  const ct = probe.headers.get("content-type") ?? "";
  const loc = probe.headers.get("location") ?? "";
  console.log(fmt("HTTP status", `${probe.status} (${probe.ms}ms)`, probe.status === 200 || probe.status === 401));
  console.log(fmt("Content-Type", ct || "(none)", ct.includes("application/json")));
  if (loc) console.log(fmt("Location header", loc, false));

  const looksBlocked =
    /urlblock|blockpage|captive|forticlient|fortinet|netskope|zscaler|policy/i.test(
      loc + " " + probe.text.slice(0, 1024),
    ) ||
    (probe.status >= 300 && probe.status < 400 && /^http:\/\/(?:10\.|172\.|192\.168\.|169\.254\.|127\.)/.test(loc));

  console.log("");
  diagnose({
    status: probe.status,
    ct,
    loc,
    looksBlocked,
    bodySnippet: probe.text.slice(0, 200),
    apiKey,
  });
}

interface Diagnosis {
  unreachable?: boolean;
  status?: number;
  ct?: string;
  loc?: string;
  looksBlocked?: boolean;
  bodySnippet?: string;
  apiKey?: string;
}

function diagnose(d: Diagnosis) {
  console.log("Diagnosis:");

  if (d.unreachable) {
    console.log("  Your machine cannot open a TCP/TLS connection to api.groq.com.");
    console.log("  Likely causes: offline, DNS broken, firewall blocking egress.");
    console.log("  Try:");
    console.log("    - check basic connectivity: curl -v https://www.google.com");
    console.log("    - switch to a different network (personal hotspot)");
    console.log("    - if behind a corporate proxy, set HTTPS_PROXY in .env.local");
    return;
  }

  if (d.looksBlocked) {
    console.log("  Your network is intercepting api.groq.com (corporate proxy / URL filter).");
    console.log("  This is the most likely reason for 'Connection error' from Groq.");
    console.log("  Fix in priority order:");
    console.log("    1. Disconnect from VPN, switch to a personal hotspot, retry.");
    console.log("    2. Ask IT to allow-list api.groq.com on the proxy.");
    console.log("    3. If you have a working forward proxy, set:");
    console.log("         HTTPS_PROXY=http://your.proxy:port    (in .env.local)");
    console.log("    4. If you have a Groq mirror / regional gateway, set:");
    console.log("         GROQ_BASE_URL=https://mirror.example.com    (in .env.local)");
    return;
  }

  if (d.status === 200 || d.status === 401) {
    console.log("  Groq is reachable from this machine.");
    if (d.status === 401)
      console.log("  Got 401 (expected with this probe). Your network is fine.");
    if (!d.apiKey) console.log("  But GROQ_API_KEY is missing — set it in .env.local.");
    else
      console.log(
        "  If ingestion is still failing, the issue is with the request body or model name.",
      );
    return;
  }

  console.log(`  Got HTTP ${d.status} from api.groq.com.`);
  if (d.bodySnippet)
    console.log(`  Body snippet: ${d.bodySnippet.replace(/\s+/g, " ").slice(0, 160)}`);
  console.log("  Inspect the headers above to identify the upstream device.");
}

main().catch((err) => {
  console.error("doctor crashed:", err);
  process.exit(1);
});
