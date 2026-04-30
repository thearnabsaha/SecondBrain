import { ensureSchema } from "@/lib/db";
import { hasPostgres } from "@/lib/config";
import { requireUser } from "@/lib/auth/current-user";
import { buildGraph } from "@/lib/services/graphService";
import { GraphCanvas } from "../../_components/GraphCanvas";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function GraphPage() {
  if (!hasPostgres()) {
    return (
      <Card>
        <CardContent className="py-14 text-center">
          <h3 className="text-lg font-medium">Postgres not configured</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Set <code className="rounded bg-muted px-1 py-0.5">POSTGRES_URL</code>{" "}
            in <code className="rounded bg-muted px-1 py-0.5">.env.local</code>{" "}
            to view the graph.
          </p>
        </CardContent>
      </Card>
    );
  }

  await ensureSchema();
  const user = await requireUser();
  const data = await buildGraph(user.id);

  return (
    <>
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Graph</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every person you know, every connection between them.
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="secondary">{data.nodes.length} people</Badge>
          <Badge variant="secondary">{data.edges.length} connections</Badge>
        </div>
      </div>

      <div className="graph-shell">
        {data.nodes.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
            <h3 className="text-lg font-medium text-foreground">Empty graph</h3>
            <p className="mt-2 text-sm">
              Capture some notes to populate the graph.
            </p>
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
