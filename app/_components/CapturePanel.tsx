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
    if (state?.ok) setContent("");
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

            {state?.ok && (
              <div className="space-y-3">
                <Separator />
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Last ingest
                </div>
                <div className="space-y-2">
                  {state.data.people.map((p) => (
                    <Link
                      key={p.id}
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
