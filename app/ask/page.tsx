import { AskPanel } from "../_components/AskPanel";

export default function AskPage() {
  return (
    <>
      <div className="mb-7 flex items-end justify-between gap-4">
        <div>
          <h1 className="m-0 text-[26px] font-bold tracking-tight">Ask</h1>
          <p className="mt-1 text-[13px] text-[var(--color-text-dim)]">
            Ask natural-language questions about the people you know.
          </p>
        </div>
      </div>

      <AskPanel />
    </>
  );
}
