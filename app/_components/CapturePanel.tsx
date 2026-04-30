"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { ingestAction, type IngestActionResult } from "../actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";

interface Props {
  examples: string[];
}

export function CapturePanel({ examples }: Props) {
  const [content, setContent] = useState("");
  const formRef = useRef<HTMLFormElement | null>(null);

  const [state, formAction, pending] = useActionState<
    IngestActionResult | null,
    FormData
  >(ingestAction, null);

  useEffect(() => {
    if (state?.ok && !state.data.pending) setContent("");
  }, [state]);

  return (
    <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-[1.4fr_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>New note</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            ref={formRef}
            action={formAction}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                formRef.current?.requestSubmit();
              }
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="content" className="sr-only">
                Note
              </Label>
              <Textarea
                id="content"
                name="content"
                placeholder="e.g. Met Aarav at the gym. Works at TCS, doesn't smoke. His girlfriend Maya is a doctor."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                disabled={pending}
                rows={6}
                className="resize-y"
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">
                {content.length} chars · ⌘/Ctrl + Enter to submit
              </span>
              <Button
                type="submit"
                disabled={pending || !content.trim()}
                size="sm"
              >
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                {pending ? "Thinking…" : "Capture"}
              </Button>
            </div>

            {state && !state.ok && (
              <Alert variant="destructive">
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            )}

            {state?.ok && state.data.pending && (
              <Alert>
                <AlertDescription>
                  <div className="space-y-2 text-sm">
                    <div className="font-medium">
                      Note saved — but the AI couldn't process it yet.
                    </div>
                    {state.data.pending.suspectedNetworkBlock ? (
                      <div className="space-y-1.5 text-muted-foreground">
                        <div>
                          Looks like your network is blocking{" "}
                          <code className="rounded bg-muted px-1 py-0.5 text-xs">
                            api.groq.com
                          </code>{" "}
                          (corporate proxy, VPN URL filter, or captive
                          portal).
                        </div>
                        <div>To fix, try one of:</div>
                        <ul className="ml-4 list-disc space-y-0.5">
                          <li>
                            switch to a personal hotspot or disconnect from
                            your VPN, then click Capture again,
                          </li>
                          <li>
                            run{" "}
                            <code className="rounded bg-muted px-1 py-0.5 text-xs">
                              npm run llm:doctor
                            </code>{" "}
                            in the project to diagnose your network,
                          </li>
                          <li>
                            or set{" "}
                            <code className="rounded bg-muted px-1 py-0.5 text-xs">
                              HTTPS_PROXY
                            </code>{" "}
                            /{" "}
                            <code className="rounded bg-muted px-1 py-0.5 text-xs">
                              GROQ_BASE_URL
                            </code>{" "}
                            in <code>.env.local</code> and restart the dev
                            server.
                          </li>
                        </ul>
                      </div>
                    ) : (
                      <div className="text-muted-foreground">
                        {state.data.pending.reason
                          .split("\n")[0]
                          .slice(0, 200)}
                      </div>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {state?.ok && !state.data.pending && (
              <div className="space-y-3">
                <Separator />
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Last ingest
                </div>
                <div className="space-y-2">
                  {state.data.people.map((p, i) => (
                    <Link
                      key={`${p.id}-${i}`}
                      href={`/people/${p.id}`}
                      className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm transition-colors hover:bg-muted"
                    >
                      <div>
                        <span className="font-medium">{p.name}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {p.is_new ? "newly added" : "updated"}
                        </span>
                      </div>
                      <Badge variant="secondary">
                        {p.attributes_added} new attr
                        {p.attributes_added === 1 ? "" : "s"}
                      </Badge>
                    </Link>
                  ))}
                  <div className="flex gap-2 pt-1">
                    <Badge variant="secondary">
                      {state.data.relationships_added} new relationships
                    </Badge>
                    <Badge variant="outline">
                      {state.data.relationships_reinforced} reinforced
                    </Badge>
                  </div>
                </div>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How it works</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Each note is read by the LLM, which identifies people, extracts
            attributes (job, lifestyle, traits), and infers relationships.
            Existing people are matched by name and merged — nothing gets
            duplicated. Profiles and summaries update automatically.
          </p>
          <Separator className="my-4" />
          <div className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">
            Try an example
          </div>
          <div className="space-y-2">
            {examples.map((ex, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setContent(ex)}
                className="w-full rounded-md border bg-muted/20 p-3 text-left text-sm leading-relaxed text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {ex}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
