import { listPeople } from "../repos/peopleRepo";
import { getAllRelationships } from "../repos/relationshipsRepo";
import { getActiveAttributes } from "../repos/attributesRepo";
import type { RelationshipType } from "../types";

export interface GraphNode {
  id: string;
  name: string;
  attributeCount: number;
  blurb?: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: RelationshipType;
  label: string | null;
  weight: number;
}

export interface GraphPayload {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export async function buildGraph(): Promise<GraphPayload> {
  const people = await listPeople();
  const nodes: GraphNode[] = await Promise.all(
    people.map(async (p) => {
      const attrs = await getActiveAttributes(p.id);
      const headline =
        attrs.find((a) => a.category === "professional")?.value ??
        attrs.find((a) => a.category === "context")?.value ??
        attrs[0]?.value;
      return {
        id: p.id,
        name: p.name,
        attributeCount: attrs.length,
        blurb: headline,
      };
    }),
  );

  const seen = new Set<string>();
  const edges: GraphEdge[] = [];
  const all = await getAllRelationships();
  for (const r of all) {
    const key = [r.from_person_id, r.to_person_id, r.type].sort().join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push({
      id: r.id,
      source: r.from_person_id,
      target: r.to_person_id,
      type: r.type,
      label: r.label,
      weight: Math.min(1 + Math.log2(r.reinforcement_count + 1), 6),
    });
  }
  return { nodes, edges };
}
