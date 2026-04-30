import { AskPanel } from "../../_components/AskPanel";

export default function AskPage() {
  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Ask</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ask natural-language questions about the people you know.
        </p>
      </div>
      <AskPanel />
    </>
  );
}
