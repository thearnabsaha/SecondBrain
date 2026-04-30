"use client";

import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";
import { askAction, type AskActionResult } from "../actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

const examples = [
  "Who works at TCS?",
  "Who do I know that's into climbing?",
  "Who is Aarav dating?",
  "Which of my colleagues live in Bangalore?",
  "Who introduced me to Maya?",
];

export function AskPanel() {
  const [question, setQuestion] = useState("");
  const [state, formAction, pending] = useActionState<
    AskActionResult | null,
    FormData
  >(askAction, null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your question</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="question" className="sr-only">
              Question
            </Label>
            <Input
              id="question"
              name="question"
              autoFocus
              placeholder="e.g. Who works at TCS and climbs on weekends?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              disabled={pending}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {examples.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => setQuestion(ex)}
                  className="cursor-pointer"
                >
                  <Badge
                    variant="secondary"
                    className="font-normal hover:bg-accent"
                  >
                    {ex}
                  </Badge>
                </button>
              ))}
            </div>
            <Button
              type="submit"
              disabled={pending || !question.trim()}
              size="sm"
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {pending ? "Thinking…" : "Ask"}
            </Button>
          </div>

          {state && !state.ok && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          {state?.ok && <div className="ask-answer">{state.answer}</div>}
        </form>
      </CardContent>
    </Card>
  );
}
