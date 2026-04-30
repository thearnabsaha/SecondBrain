"use client";

import { useActionState, useState } from "react";
import { enrichAction, type EnrichActionResult } from "../actions";

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
    <form action={formAction} className="card">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <div className="card-title m-0">Web enrichment</div>
        <span className="tag tag-accent">Tavily</span>
      </div>
      <p className="m-0 text-[12px] text-[var(--color-text-faint)]">
        Pull public info about {personName}'s company, school, or role and
        merge it as low-confidence attributes.
      </p>

      <input type="hidden" name="person_id" value={personId} />

      <div className="mt-3.5 flex items-center gap-2">
        <input
          name="query"
          className="input flex-1"
          placeholder="Custom query (optional, e.g. 'TCS company')"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? <span className="spinner" /> : null}
          {pending ? "Searching…" : "Enrich"}
        </button>
      </div>

      {state && !state.ok && (
        <div className="error-banner mt-3">{state.error}</div>
      )}

      {state?.ok && (
        <div className="mt-3.5">
          <div className="text-[12px] text-[var(--color-text-faint)]">
            Searched: <strong>"{state.data.query}"</strong> · {state.data.added}{" "}
            new attribute{state.data.added === 1 ? "" : "s"} added
          </div>
          {state.data.rationale && (
            <p className="mt-2 text-[13px]">{state.data.rationale}</p>
          )}
          {state.data.attributes.length > 0 && (
            <div className="mt-2 flex flex-col gap-1.5">
              {state.data.attributes.map((a, i) => (
                <div key={i} className="attribute-row">
                  <span className="text-[13px] font-medium">
                    [{a.category}] {a.key}
                  </span>
                  <span className="ml-2.5 flex-1 text-right text-[13px] text-[var(--color-text-dim)]">
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
            <div className="mt-2.5">
              <div className="text-[11px] text-[var(--color-text-faint)]">
                Sources:
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {state.data.sources.slice(0, 3).map((s, i) => (
                  <a
                    key={i}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="tag"
                  >
                    {truncate(s.title || s.url, 40)}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </form>
  );
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}
