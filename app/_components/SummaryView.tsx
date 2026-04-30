"use client";

import { useMemo, useState } from "react";
import { List, AlignLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface SummaryViewProps {
  /** The prose summary saved in the DB. May be empty/missing. */
  prose: string | null;
  /**
   * Newline-separated bullets saved by `generateBullets`. May be null
   * (older summaries that pre-date the bullets column) — in that case we
   * derive bullets on the fly by splitting the prose into sentences.
   */
  bullets: string | null;
}

type Mode = "bullets" | "summary";

/**
 * Two-tab view of a person's summary:
 *   - "Bullets"  (default): scannable list of facts.
 *   - "Summary"            : prose paragraph version.
 *
 * If we have explicit `bullets` from the LLM we use them. Otherwise we
 * gracefully fall back to splitting the prose into sentences so older
 * summaries (generated before the bullets column existed) still get a
 * useful Bullets tab without re-running the LLM.
 */
export function SummaryView({ prose, bullets }: SummaryViewProps) {
  const [mode, setMode] = useState<Mode>("bullets");

  const bulletList = useMemo(
    () => (bullets ? splitBullets(bullets) : deriveBullets(prose)),
    [bullets, prose],
  );

  const proseText = (prose ?? "").trim();

  if (!proseText && bulletList.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Summary will appear here after the first ingest finishes processing.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div
        role="tablist"
        aria-label="Summary view mode"
        className="inline-flex rounded-md border bg-muted/30 p-0.5"
      >
        <TabButton
          mode="bullets"
          active={mode === "bullets"}
          onClick={() => setMode("bullets")}
          Icon={List}
          label="Bullets"
        />
        <TabButton
          mode="summary"
          active={mode === "summary"}
          onClick={() => setMode("summary")}
          Icon={AlignLeft}
          label="Summary"
        />
      </div>

      {mode === "bullets" ? (
        bulletList.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No bullet points available yet.
          </p>
        ) : (
          <ul className="space-y-1.5 text-sm leading-6">
            {bulletList.map((b, i) => (
              <li key={i} className="flex gap-2">
                <span
                  aria-hidden
                  className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        )
      ) : proseText ? (
        <p className="summary-text m-0">{proseText}</p>
      ) : (
        <p className="text-sm text-muted-foreground">
          No prose summary available — switch to Bullets.
        </p>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  Icon,
  label,
}: {
  mode: Mode;
  active: boolean;
  onClick: () => void;
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function splitBullets(blob: string): string[] {
  return blob
    .split(/\r?\n/)
    .map((s) => s.replace(/^[\s•\-*\u2022]+/, "").trim())
    .filter(Boolean);
}

/**
 * Crude sentence splitter so old prose summaries still get a Bullets tab.
 * Only used when the DB has no `bullets` column value (legacy rows) — real
 * LLM-generated bullets are much better. Drops sentences that contain
 * hedging words ("seems to", "appears to", ...) so legacy summaries don't
 * resurrect old guesses on the Bullets tab.
 */
function deriveBullets(prose: string | null): string[] {
  if (!prose) return [];
  const text = prose.replace(/\s+/g, " ").trim();
  if (!text) return [];
  const sentences = text
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 4)
    .filter((s) => !LEGACY_HEDGE_RE.test(s));
  return sentences.slice(0, 8);
}

const LEGACY_HEDGE_RE =
  /\b(seems?|appears?|likely|probabl[yi]|may|might|perhaps|presumably|suggest(s|ed)?|possibl[yi])\b/i;
