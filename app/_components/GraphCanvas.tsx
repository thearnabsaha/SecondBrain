"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type {
  GraphEdge,
  GraphNode,
  GraphZone,
  GraphZoneDimension,
} from "@/lib/services/graphService";
import { cn } from "@/lib/utils";

interface Props {
  nodes: GraphNode[];
  edges: GraphEdge[];
  zoneDimensions: GraphZoneDimension[];
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
  onRenderFramePre?: (
    ctx: CanvasRenderingContext2D,
    scale: number,
  ) => void;
}>;

interface ResolvedZone {
  zone: GraphZone;
  dimensionId: string;
  /** HSL hue. Stable per zone label so colors don't flicker between renders. */
  hue: number;
}

/**
 * Stable hash → HSL hue. Same input always produces same color across
 * sessions, so the "PwC" bubble is the same color every time.
 */
function hashHue(input: string): number {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h) ^ input.charCodeAt(i);
  }
  // Spread across the wheel; bias slightly off-red so red stays for "danger" UI.
  return ((h >>> 0) % 360 + 30) % 360;
}

/**
 * Andrew's monotone chain — O(n log n) convex hull. Returns the hull points
 * in counter-clockwise order. Pure, no deps.
 */
function convexHull(points: { x: number; y: number }[]): { x: number; y: number }[] {
  if (points.length <= 1) return points.slice();
  const pts = points
    .slice()
    .sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
  const cross = (
    o: { x: number; y: number },
    a: { x: number; y: number },
    b: { x: number; y: number },
  ) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: typeof pts = [];
  for (const p of pts) {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0
    )
      lower.pop();
    lower.push(p);
  }
  const upper: typeof pts = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0
    )
      upper.pop();
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

/**
 * Inflate a hull outward from its centroid by `padding` pixels (in graph
 * coords) so the bubble visibly contains the nodes rather than clipping
 * them. Cheap approximation, good enough for visualization.
 */
function inflateHull(
  hull: { x: number; y: number }[],
  padding: number,
): { x: number; y: number }[] {
  if (hull.length === 0) return hull;
  let cx = 0;
  let cy = 0;
  for (const p of hull) {
    cx += p.x;
    cy += p.y;
  }
  cx /= hull.length;
  cy /= hull.length;
  return hull.map((p) => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const len = Math.hypot(dx, dy) || 1;
    return { x: p.x + (dx / len) * padding, y: p.y + (dy / len) * padding };
  });
}

/**
 * Smooth a polygon by inserting a midpoint between each pair of neighbors
 * (one Chaikin-corner-cutting iteration). One pass is enough to make the
 * bubble look organic without rounding away the actual outer points.
 */
function smoothHull(
  hull: { x: number; y: number }[],
): { x: number; y: number }[] {
  if (hull.length < 3) return hull;
  const out: typeof hull = [];
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i];
    const b = hull[(i + 1) % hull.length];
    out.push({ x: 0.75 * a.x + 0.25 * b.x, y: 0.75 * a.y + 0.25 * b.y });
    out.push({ x: 0.25 * a.x + 0.75 * b.x, y: 0.25 * a.y + 0.75 * b.y });
  }
  return out;
}

/**
 * react-force-graph-2d is browser-only. Imported imperatively so it never
 * appears in the server bundle.
 */
export function GraphCanvas({ nodes, edges, zoneDimensions }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [ForceGraph, setForceGraph] = useState<ForceGraphComponent | null>(
    null,
  );
  const router = useRouter();

  // Active dimension chips (ids of dimensions the user has toggled on).
  // Default: first (most-populated) dimension if any exists.
  const [activeDimIds, setActiveDimIds] = useState<Set<string>>(() => {
    const first = zoneDimensions[0]?.id;
    return new Set(first ? [first] : []);
  });

  // Live ref so the per-frame underlay doesn't capture stale state.
  const activeDimsRef = useRef(activeDimIds);
  useEffect(() => {
    activeDimsRef.current = activeDimIds;
  }, [activeDimIds]);

  // Live ref for nodes so onRenderFramePre always sees current positions
  // (the force engine mutates node.x/node.y in place each tick).
  const nodesRef = useRef<ForceNode[]>([]);

  // Pre-resolve every zone (across every dimension) into a stable color +
  // dimension-id pairing. Cheap and avoids re-hashing every frame.
  const resolvedZones = useMemo(() => {
    const out: ResolvedZone[] = [];
    for (const dim of zoneDimensions) {
      for (const zone of dim.zones) {
        out.push({
          zone,
          dimensionId: dim.id,
          hue: hashHue(`${dim.id}::${zone.id}`),
        });
      }
    }
    return out;
  }, [zoneDimensions]);

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

  // Stable node array for the force graph. Mapped once and cached so
  // react-force-graph doesn't re-init the simulation on every render.
  const graphData = useMemo(() => {
    const mapped: ForceNode[] = nodes.map((n) => ({ ...n }));
    nodesRef.current = mapped;
    return {
      nodes: mapped,
      links: edges.map((e) => ({
        source: e.source,
        target: e.target,
        type: e.type,
        label: e.label,
        weight: e.weight,
      })),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.length, edges.length]);

  const renderFramePre = useCallback(
    (ctx: CanvasRenderingContext2D, scale: number) => {
      const active = activeDimsRef.current;
      if (active.size === 0) return;

      // Build personId → {x,y} map once per frame.
      const pos = new Map<string, { x: number; y: number }>();
      for (const n of nodesRef.current) {
        if (typeof n.x === "number" && typeof n.y === "number") {
          pos.set(n.id, { x: n.x, y: n.y });
        }
      }
      if (pos.size === 0) return;

      // Padding scales with zoom so bubbles don't shrink to slivers when
      // zoomed out, nor balloon when zoomed in.
      const padding = 22 / Math.max(scale, 0.4);

      ctx.save();
      ctx.lineWidth = 1.5 / scale;
      for (const rz of resolvedZones) {
        if (!active.has(rz.dimensionId)) continue;
        const points: { x: number; y: number }[] = [];
        for (const id of rz.zone.memberIds) {
          const p = pos.get(id);
          if (p) points.push(p);
        }
        if (points.length === 0) continue;

        ctx.fillStyle = `hsla(${rz.hue} 75% 55% / 0.16)`;
        ctx.strokeStyle = `hsla(${rz.hue} 75% 65% / 0.55)`;

        if (points.length === 1) {
          // Single-member zone (rare given MIN_MEMBERS_PER_ZONE = 2 in
          // the service, but possible if some members were filtered):
          // draw a small disk so the zone is still visible.
          const r = 28 / Math.max(scale, 0.4);
          ctx.beginPath();
          ctx.arc(points[0].x, points[0].y, r, 0, 2 * Math.PI);
          ctx.fill();
          ctx.stroke();
          drawZoneLabel(ctx, scale, rz.zone.label, points[0].x, points[0].y - r - 4 / scale);
          continue;
        }

        if (points.length === 2) {
          // 2 points: convex hull collapses to a line. Draw a fat
          // capsule by stroking + filling a thick line.
          const [a, b] = points;
          const r = 24 / Math.max(scale, 0.4);
          const cx = (a.x + b.x) / 2;
          const cy = (a.y + b.y) / 2;
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(Math.atan2(b.y - a.y, b.x - a.x));
          const len = Math.hypot(b.x - a.x, b.y - a.y);
          ctx.beginPath();
          // Capsule = round rect with semicircular ends.
          ctx.arc(-len / 2, 0, r, Math.PI / 2, -Math.PI / 2);
          ctx.lineTo(len / 2, -r);
          ctx.arc(len / 2, 0, r, -Math.PI / 2, Math.PI / 2);
          ctx.lineTo(-len / 2, r);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
          drawZoneLabel(ctx, scale, rz.zone.label, cx, cy - r - 4 / scale);
          continue;
        }

        const hull = smoothHull(inflateHull(convexHull(points), padding));
        ctx.beginPath();
        ctx.moveTo(hull[0].x, hull[0].y);
        for (let i = 1; i < hull.length; i++) {
          ctx.lineTo(hull[i].x, hull[i].y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Label at the topmost point of the hull.
        let topIdx = 0;
        for (let i = 1; i < hull.length; i++) {
          if (hull[i].y < hull[topIdx].y) topIdx = i;
        }
        drawZoneLabel(
          ctx,
          scale,
          rz.zone.label,
          hull[topIdx].x,
          hull[topIdx].y - 6 / scale,
        );
      }
      ctx.restore();
    },
    [resolvedZones],
  );

  const toggleDim = (id: string) => {
    setActiveDimIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="absolute inset-0 flex flex-col">
      {zoneDimensions.length > 0 && (
        <div className="zone-chips">
          <span className="zone-chips__label">Group by</span>
          {zoneDimensions.map((d) => {
            const active = activeDimIds.has(d.id);
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => toggleDim(d.id)}
                className={cn("zone-chip", active && "zone-chip--active")}
                title={`${d.zones.length} zones · ${d.peopleCount} people`}
              >
                {d.label}
                <span className="zone-chip__count">{d.zones.length}</span>
              </button>
            );
          })}
          {activeDimIds.size > 0 && (
            <button
              type="button"
              onClick={() => setActiveDimIds(new Set())}
              className="zone-chip zone-chip--clear"
            >
              Clear
            </button>
          )}
        </div>
      )}
      <div ref={containerRef} className="relative flex-1">
        {ForceGraph ? (
          <>
            <ForceGraph
              width={size.w}
              height={size.h}
              graphData={graphData}
              backgroundColor="rgba(0,0,0,0)"
              linkColor={() => "rgba(255,255,255,0.18)"}
              linkWidth={(l) => l.weight}
              cooldownTicks={120}
              onNodeClick={(node) => router.push(`/people/${node.id}`)}
              onRenderFramePre={renderFramePre}
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
            {activeDimIds.size > 0 && (
              <ZoneLegend
                resolvedZones={resolvedZones}
                activeDimIds={activeDimIds}
              />
            )}
          </>
        ) : (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading graph…
          </div>
        )}
      </div>
    </div>
  );
}

function drawZoneLabel(
  ctx: CanvasRenderingContext2D,
  scale: number,
  label: string,
  x: number,
  y: number,
) {
  // Skip label when zoomed way out — it just becomes noise.
  if (scale < 0.55) return;
  ctx.save();
  ctx.font = `600 ${11 / scale}px Inter, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  // Tiny text-shadow for legibility over the bubble fill.
  ctx.shadowColor = "rgba(0,0,0,0.75)";
  ctx.shadowBlur = 6 / scale;
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.fillText(label, x, y);
  ctx.restore();
}

function ZoneLegend({
  resolvedZones,
  activeDimIds,
}: {
  resolvedZones: ResolvedZone[];
  activeDimIds: Set<string>;
}) {
  const visible = resolvedZones.filter((rz) => activeDimIds.has(rz.dimensionId));
  if (visible.length === 0) return null;
  return (
    <div className="zone-legend">
      {visible.map((rz) => (
        <div key={`${rz.dimensionId}::${rz.zone.id}`} className="zone-legend__row">
          <span
            className="zone-legend__swatch"
            style={{
              background: `hsla(${rz.hue} 75% 55% / 0.55)`,
              borderColor: `hsla(${rz.hue} 75% 65% / 0.85)`,
            }}
          />
          <span className="zone-legend__label">
            {rz.zone.label}
            <span className="zone-legend__count">{rz.zone.memberIds.length}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
