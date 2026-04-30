import { ensureSchema } from "@/lib/db";
import { hasPostgres } from "@/lib/config";
import { buildGraph } from "@/lib/services/graphService";
import { GraphCanvas } from "../_components/GraphCanvas";

export const dynamic = "force-dynamic";

export default async function GraphPage() {
  if (!hasPostgres()) {
    return (
      <div className="card text-center" style={{ padding: "40px 20px" }}>
        <h3 className="m-0 mb-2 text-[var(--color-text)]">
          Postgres not configured
        </h3>
        <p className="m-0 text-[var(--color-text-dim)]">
          Set <code>POSTGRES_URL</code> in <code>.env.local</code> to view the
          graph.
        </p>
      </div>
    );
  }

  await ensureSchema();
  const data = await buildGraph();

  return (
    <>
      <div className="mb-7 flex items-end justify-between gap-4">
        <div>
          <h1 className="m-0 text-[26px] font-bold tracking-tight">Graph</h1>
          <p className="mt-1 text-[13px] text-[var(--color-text-dim)]">
            Every person you know, every connection between them.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="tag">{data.nodes.length} people</span>
          <span className="tag">{data.edges.length} connections</span>
        </div>
      </div>

      <div className="graph-shell">
        {data.nodes.length === 0 ? (
          <div
            className="text-center text-[var(--color-text-dim)]"
            style={{ paddingTop: 80 }}
          >
            <h3 className="m-0 mb-2 text-[var(--color-text)]">Empty graph</h3>
            <p className="m-0">Capture some notes to populate the graph.</p>
          </div>
        ) : (
          <GraphCanvas nodes={data.nodes} edges={data.edges} />
        )}
        <div className="graph-legend">
          Click a node to open the profile · drag to rearrange
        </div>
      </div>
    </>
  );
}
