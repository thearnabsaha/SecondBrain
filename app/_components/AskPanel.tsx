"use client";

import { useActionState, useState } from "react";
import { askAction, type AskActionResult } from "../actions";

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
    <form action={formAction} className="card">
      <label className="label" htmlFor="question">
        Your question
      </label>
      <input
        id="question"
        name="question"
        autoFocus
        className="input"
        placeholder="e.g. Who works at TCS and climbs on weekends?"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
      />

      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {examples.map((ex) => (
            <button
              key={ex}
              type="button"
              className="tag cursor-pointer"
              onClick={() => setQuestion(ex)}
            >
              {ex}
            </button>
          ))}
        </div>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={pending || !question.trim()}
        >
          {pending ? <span className="spinner" /> : null}
          {pending ? "Thinking…" : "Ask"}
        </button>
      </div>

      {state && !state.ok && (
        <div className="error-banner mt-3.5">{state.error}</div>
      )}

      {state?.ok && <div className="ask-answer">{state.answer}</div>}
    </form>
  );
}
