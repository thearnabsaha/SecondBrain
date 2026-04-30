"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { GraphEdge, GraphNode } from "@/lib/services/graphService";

interface Props {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface ForceNode extends GraphNode {
  x?: number;
  y?: number;
}
interface ForceLink {
  source: string | ForceNode;
  target: string | ForceNode;
  type: string;
  label: string | null;
  weight: number;
}

type ForceGraphComponent = ComponentType<{
  width: number;
  height: number;
  graphData: { nodes: ForceNode[]; links: ForceLink[] };
  backgroundColor?: string;
  linkColor?: () => string;
  linkWidth?: (l: ForceLink) => number;
  cooldownTicks?: number;
  onNodeClick?: (node: ForceNode) => void;
  nodeCanvasObjectMode?: () => "after" | "before" | "replace";
  nodeCanvasObject?: (
    node: ForceNode,
    ctx: CanvasRenderingContext2D,
    scale: number,
  ) => void;
}>;

/**
 * react-force-graph-2d is browser-only. Imported imperatively so it never
 * appears in the server bundle.
 */
export function GraphCanvas({ nodes, edges }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [ForceGraph, setForceGraph] = useState<ForceGraphComponent | null>(
    null,
  );
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    import("react-force-graph-2d").then((mod) => {
      if (cancelled) return;
      const Component = (mod.default ?? mod) as ForceGraphComponent;
      setForceGraph(() => Component);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setSize({ w: r.width, h: r.height });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="absolute inset-0">
      {ForceGraph ? (
        <ForceGraph
          width={size.w}
          height={size.h}
          graphData={{
            nodes: nodes.map((n) => ({ ...n })),
            links: edges.map((e) => ({
              source: e.source,
              target: e.target,
              type: e.type,
              label: e.label,
              weight: e.weight,
            })),
          }}
          backgroundColor="rgba(0,0,0,0)"
          linkColor={() => "rgba(255,255,255,0.18)"}
          linkWidth={(l) => l.weight}
          cooldownTicks={120}
          onNodeClick={(node) => router.push(`/people/${node.id}`)}
          nodeCanvasObjectMode={() => "after"}
          nodeCanvasObject={(node, ctx, scale) => {
            const r = 6 + Math.min(8, Math.sqrt(node.attributeCount + 1) * 2);
            const x = node.x ?? 0;
            const y = node.y ?? 0;

            ctx.beginPath();
            ctx.arc(x, y, r, 0, 2 * Math.PI);
            ctx.fillStyle = "#7c5cff";
            ctx.fill();
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = "rgba(255,255,255,0.25)";
            ctx.stroke();

            if (scale > 0.9) {
              ctx.font = `${12 / scale}px Inter, sans-serif`;
              ctx.fillStyle = "#e6e7ee";
              ctx.textAlign = "center";
              ctx.textBaseline = "top";
              ctx.fillText(node.name, x, y + r + 2 / scale);
            }
          }}
        />
      ) : (
        <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading graph…
        </div>
      )}
    </div>
  );
}
