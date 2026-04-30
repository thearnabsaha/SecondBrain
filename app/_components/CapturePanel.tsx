"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ingestAction, type IngestActionResult } from "../actions";

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
    if (state?.ok) {
      setContent("");
    }
  }, [state]);

  return (
    <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-[1.4fr_1fr]">
      <form
        ref={formRef}
        action={formAction}
        className="card"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            formRef.current?.requestSubmit();
          }
        }}
      >
        <label className="label" htmlFor="content">
          New note
        </label>
        <textarea
          id="content"
          name="content"
          className="textarea"
          placeholder="e.g. Met Aarav at the gym. Works at TCS, doesn't smoke. His girlfriend Maya is a doctor."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          disabled={pending}
        />
        <div className="mt-3.5 flex items-center justify-between gap-3">
          <span className="text-[12px] text-[var(--color-text-faint)]">
            {content.length} chars · ⌘/Ctrl + Enter to submit
          </span>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={pending || !content.trim()}
          >
            {pending ? <span className="spinner" /> : null}
            {pending ? "Thinking…" : "Capture"}
          </button>
        </div>

        {state && !state.ok && (
          <div className="error-banner mt-3.5">{state.error}</div>
        )}

        {state?.ok && (
          <div className="mt-4">
            <div className="card-title">Last ingest</div>
            <div className="flex flex-col gap-2.5">
              {state.data.people.map((p) => (
                <Link
                  key={p.id}
                  href={`/people/${p.id}`}
                  className={`flex items-center justify-between rounded-[10px] border px-3.5 py-2.5 ${
                    p.is_new
                      ? "border-[rgba(94,224,161,0.4)] bg-[rgba(94,224,161,0.06)]"
                      : "border-[var(--color-border)] bg-[var(--color-bg-1)]"
                  }`}
                >
                  <div>
                    <strong>{p.name}</strong>
                    <span className="ml-2 text-[12px] text-[var(--color-text-faint)]">
                      {p.is_new ? "newly added" : "updated"}
                    </span>
                  </div>
                  <span className="tag">
                    {p.attributes_added} new attr
                    {p.attributes_added === 1 ? "" : "s"}
                  </span>
                </Link>
              ))}
              <div className="mt-1.5 flex items-center gap-3">
                <span className="tag tag-good">
                  {state.data.relationships_added} new relationships
                </span>
                <span className="tag">
                  {state.data.relationships_reinforced} reinforced
                </span>
              </div>
            </div>
          </div>
        )}
      </form>

      <div className="card">
        <div className="card-title">How it works</div>
        <p className="text-[13px] leading-relaxed text-[var(--color-text-dim)]">
          Each note is read by the LLM, which identifies people, extracts
          attributes (job, lifestyle, traits), and infers relationships.
          Existing people are matched by name and merged — nothing gets
          duplicated. Profiles and summaries update automatically.
        </p>
        <div className="my-4 h-px bg-[var(--color-border)]" />
        <div className="card-title">Try an example</div>
        <div className="flex flex-col gap-2.5">
          {examples.map((ex, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setContent(ex)}
              className="cursor-pointer rounded-[10px] border border-[var(--color-border)] bg-[var(--color-bg-1)] p-3 text-left text-[13px] leading-relaxed text-[var(--color-text-dim)] transition-colors hover:border-[var(--color-accent)] hover:bg-[var(--color-bg-2)] hover:text-[var(--color-text)]"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
