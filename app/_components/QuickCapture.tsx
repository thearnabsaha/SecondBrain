"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { Loader2, Mic, MicOff, X } from "lucide-react";
import { ingestAction, type IngestActionResult } from "@/app/actions";
import { useVoiceInput } from "./useVoiceInput";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/**
 * Global quick-capture modal: press ⌘K / Ctrl+K from anywhere in the app
 * to open it, type or speak a note, hit Capture. Submits via the same
 * server action as the home page; closes on success.
 *
 * Built on the native <dialog> element for free focus trap, ESC-to-close,
 * and accessibility. Mounted once at the layout level.
 */
export function QuickCapture() {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [content, setContent] = useState("");
  const [open, setOpen] = useState(false);

  const [state, formAction, pending] = useActionState<
    IngestActionResult | null,
    FormData
  >(ingestAction, null);

  const voice = useVoiceInput((finalChunk) => {
    setContent((prev) => {
      const sep = prev && !/\s$/.test(prev) ? " " : "";
      return prev + sep + finalChunk.trim();
    });
  });

  const openDialog = useCallback(() => {
    setOpen(true);
    // showModal triggers focus trap + ESC-to-close natively
    const d = dialogRef.current;
    if (d && !d.open) d.showModal();
    // focus textarea after dialog paints
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, []);

  const closeDialog = useCallback(() => {
    voice.stop();
    setOpen(false);
    const d = dialogRef.current;
    if (d?.open) d.close();
  }, [voice]);

  // Global ⌘K / Ctrl+K listener. Skip when an editable element is focused
  // and uses Cmd-K for its own purposes — there shouldn't be any in this
  // app, but it's polite to bail if the active element is a contenteditable.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isShortcut = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (!isShortcut) return;
      e.preventDefault();
      if (open) {
        closeDialog();
      } else {
        openDialog();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, openDialog, closeDialog]);

  // <dialog> fires "close" on ESC or backdrop click; sync our state.
  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    const handler = () => {
      voice.stop();
      setOpen(false);
    };
    d.addEventListener("close", handler);
    return () => d.removeEventListener("close", handler);
  }, [voice]);

  // Auto-close on successful, fully-processed ingest. Pending results
  // (DB/LLM failure) keep the modal open so the user can see the alert.
  useEffect(() => {
    if (state?.ok && !state.data.pending) {
      setContent("");
      // Show success briefly, then close.
      const t = setTimeout(closeDialog, 1500);
      return () => clearTimeout(t);
    }
  }, [state, closeDialog]);

  const liveText = voice.interim ? content + (content && !/\s$/.test(content) ? " " : "") + voice.interim : content;

  return (
    <>
      {/*
       * The dialog is always in the DOM but only painted when opened, so
       * the global keydown listener can call .showModal() without races.
       */}
      <dialog
        ref={dialogRef}
        className="fixed inset-0 m-auto w-[min(640px,calc(100%-2rem))] rounded-xl border bg-card p-0 text-card-foreground shadow-2xl backdrop:bg-foreground/40 backdrop:backdrop-blur-sm"
        aria-label="Quick capture"
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="text-sm font-semibold">Quick capture</div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={closeDialog}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form
          action={formAction}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              (e.currentTarget as HTMLFormElement).requestSubmit();
            }
          }}
          className="space-y-3 p-4"
        >
          <Textarea
            ref={textareaRef}
            name="content"
            placeholder="Drop a note about someone — Cmd/Ctrl + Enter to submit."
            value={liveText}
            onChange={(e) => {
              // While voice is active, the textarea reflects content + interim;
              // any keystroke ends voice and adopts the typed text as canon.
              if (voice.listening) voice.stop();
              setContent(e.target.value);
            }}
            disabled={pending}
            rows={5}
            className="resize-y"
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {voice.supported && (
                <Button
                  type="button"
                  variant={voice.listening ? "destructive" : "outline"}
                  size="sm"
                  onClick={() =>
                    voice.listening ? voice.stop() : voice.start()
                  }
                  disabled={pending}
                  aria-pressed={voice.listening}
                >
                  {voice.listening ? (
                    <MicOff className="h-4 w-4" />
                  ) : (
                    <Mic className="h-4 w-4" />
                  )}
                  {voice.listening ? "Stop" : "Speak"}
                </Button>
              )}
              <span className="text-xs text-muted-foreground">
                {content.length} chars · ⌘/Ctrl + Enter to submit
                {voice.listening && (
                  <span className="ml-2 inline-flex items-center gap-1 text-destructive">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-destructive" />
                    listening
                  </span>
                )}
              </span>
            </div>
            <Button
              type="submit"
              size="sm"
              disabled={pending || !content.trim()}
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {pending ? "Thinking…" : "Capture"}
            </Button>
          </div>

          {voice.error && (
            <Alert variant="destructive">
              <AlertDescription>{voice.error}</AlertDescription>
            </Alert>
          )}

          {state && !state.ok && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          {state?.ok && state.data.pending && (
            <Alert>
              <AlertDescription className="text-xs">
                Note saved, but processing failed (
                {state.data.pending.kind}). It&apos;s safe in your{" "}
                <Link href="/inbox" className="underline">
                  Inbox
                </Link>{" "}
                — retry from there.
              </AlertDescription>
            </Alert>
          )}

          {state?.ok && !state.data.pending && (
            <div className="space-y-2 rounded-md border bg-muted/30 p-3">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Captured
              </div>
              <div className="flex flex-wrap gap-1.5">
                {state.data.people.map((p, i) => (
                  <Link
                    key={`${p.id}-${i}`}
                    href={`/people/${p.id}`}
                    className={cn(
                      "rounded-md border bg-background px-2 py-1 text-xs hover:bg-accent",
                    )}
                  >
                    {p.name}
                    <Badge variant="secondary" className="ml-1.5">
                      {p.is_new ? "new" : "+"}
                      {p.attributes_added > 0
                        ? ` ${p.attributes_added}`
                        : ""}
                    </Badge>
                  </Link>
                ))}
              </div>
              <div className="text-[11px] text-muted-foreground">
                Closing automatically…
              </div>
            </div>
          )}
        </form>
      </dialog>
    </>
  );
}
