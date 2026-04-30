"use client";

import { useActionState, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { enrichAction, type EnrichActionResult } from "../actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Props {
  personId: string;
  personName: string;
}

export function EnrichPanel({ personId, personName }: Props) {
  const [query, setQuery] = useState("");
  const [state, formAction, pending] = useActionState<
    EnrichActionResult | null,
    FormData
  >(enrichAction, null);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" /> Web enrichment
        </CardTitle>
        <Badge variant="outline">Tavily</Badge>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">
          Pull public info about {personName}&apos;s company, school, or role
          and merge it as low-confidence attributes.
        </p>

        <form action={formAction} className="mt-3 space-y-3">
          <input type="hidden" name="person_id" value={personId} />
          <div className="flex items-center gap-2">
            <Input
              name="query"
              placeholder="Custom query (optional, e.g. 'TCS company')"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={pending}
              className="flex-1"
            />
            <Button type="submit" disabled={pending} size="sm">
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {pending ? "Searching…" : "Enrich"}
            </Button>
          </div>

          {state && !state.ok && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          {state?.ok && (
            <div className="space-y-2 pt-1">
              <div className="text-xs text-muted-foreground">
                Searched: <strong>&quot;{state.data.query}&quot;</strong> ·{" "}
                {state.data.added} new attribute
                {state.data.added === 1 ? "" : "s"} added
              </div>
              {state.data.rationale && (
                <p className="text-sm">{state.data.rationale}</p>
              )}
              {state.data.attributes.length > 0 && (
                <div className="space-y-1.5">
                  {state.data.attributes.map((a, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 rounded-md border bg-muted/30 px-3 py-1.5"
                    >
                      <span className="text-sm font-medium">
                        [{a.category}] {a.key}
                      </span>
                      <span className="ml-auto text-sm text-muted-foreground">
                        {a.value}
                      </span>
                      <div className="confidence-bar">
                        <span style={{ width: `${a.confidence * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {state.data.sources.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-xs text-muted-foreground">Sources:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {state.data.sources.slice(0, 3).map((s, i) => (
                      <a
                        key={i}
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Badge
                          variant="secondary"
                          className="font-normal hover:bg-accent"
                        >
                          {truncate(s.title || s.url, 40)}
                        </Badge>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}
