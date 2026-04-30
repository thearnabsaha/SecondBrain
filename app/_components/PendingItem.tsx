"use client";

import { useActionState, useState } from "react";
import { RotateCw, Trash2, AlertTriangle, Info } from "lucide-react";
import {
  discardPendingAction,
  retryPendingAction,
  type RetryPendingResult,
} from "@/app/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export interface PendingRow {
  noteId: string;
  content: string;
  kind: "db_unreachable" | "llm_failed";
  reason: string;
  attempts: number;
  createdAt: string;
}

/**
 * One row in the Inbox. Shows the saved note text, why it failed, and
 * Retry / Discard. On a successful retry the parent page revalidates and
 * the row disappears.
 */
export function PendingItem({ row }: { row: PendingRow }) {
  const [state, formAction, pending] = useActionState<
    RetryPendingResult | null,
    FormData
  >(retryPendingAction, null);
  const [showDetails, setShowDetails] = useState(false);
  const [discarding, setDiscarding] = useState(false);

  const isDb = row.kind === "db_unreachable";

  return (
    <li className="rounded-lg border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          {isDb ? (
            <AlertTriangle className="h-4 w-4 text-destructive" />
          ) : (
            <Info className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="text-sm whitespace-pre-wrap">{row.content}</div>
          <div className="text-xs text-muted-foreground">
            {isDb
              ? "Database was unreachable when this note was saved."
              : "AI extraction failed for this note."}{" "}
            · saved {formatRelative(row.createdAt)} · {row.attempts}{" "}
            {row.attempts === 1 ? "attempt" : "attempts"}
            <button
              type="button"
              onClick={() => setShowDetails((s) => !s)}
              className="ml-2 underline-offset-2 hover:underline"
            >
              {showDetails ? "hide" : "show"} technical details
            </button>
          </div>
          {showDetails && (
            <pre className="max-h-40 overflow-auto rounded-md bg-muted/40 p-2 text-[11px] leading-snug">
              {row.reason}
            </pre>
          )}

          {state?.ok === false && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          {state?.ok === true && state.data.pending && (
            <Alert variant="destructive">
              <AlertDescription>
                Retry failed again ({state.data.pending.kind}) — try once
                more in a moment.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <form action={formAction}>
              <input type="hidden" name="note_id" value={row.noteId} />
              <Button
                type="submit"
                size="sm"
                disabled={pending || discarding}
              >
                <RotateCw className="h-3.5 w-3.5" />
                {pending ? "Retrying…" : "Retry"}
              </Button>
            </form>

            <form
              action={async (fd) => {
                setDiscarding(true);
                await discardPendingAction(fd);
              }}
            >
              <input type="hidden" name="note_id" value={row.noteId} />
              <Button
                type="submit"
                size="sm"
                variant="ghost"
                disabled={pending || discarding}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {discarding ? "Discarding…" : "Discard"}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </li>
  );
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diff = Date.now() - then;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}
