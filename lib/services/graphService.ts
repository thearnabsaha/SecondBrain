import { listPeople } from "../repos/peopleRepo";
import { getAllRelationships } from "../repos/relationshipsRepo";
import { getActiveAttributesForPeople } from "../repos/attributesRepo";
import type { Attribute, AttributeCategory, RelationshipType } from "../types";

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

/**
 * A zone is a named cluster of people that share the same value for some
 * (category, key) attribute pair — e.g. all people whose
 * `(professional, employer)` equals "PwC".
 */
export interface GraphZone {
  /** Stable id within a dimension. Lowercased+trimmed value, used for keys. */
  id: string;
  /** Display label, taken from the most common original-case spelling. */
  label: string;
  /** Person ids that belong to this zone (each person is in at most one
   *  zone per dimension — the "current" attribute value wins). */
  memberIds: string[];
}

/**
 * A dimension is one (category, key) pair surfaced as a way to slice the
 * graph — e.g. "Company" comes from `(professional, employer)`. Dimensions
 * with fewer than `MIN_PEOPLE_PER_DIMENSION` people across all values are
 * suppressed (1-person zones look silly and clutter the chip bar).
 */
export interface GraphZoneDimension {
  /** Stable id, e.g. "professional|employer". Used as React key + chip toggle. */
  id: string;
  category: AttributeCategory;
  key: string;
  /** Human-friendly label ("Company", "City", "College"). Falls back to the
   *  raw key when no friendly mapping is registered. */
  label: string;
  /** Total number of distinct people the dimension covers. Used for sorting. */
  peopleCount: number;
  zones: GraphZone[];
}

export interface GraphPayload {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Auto-detected zone dimensions, sorted by coverage (most populated first). */
  zoneDimensions: GraphZoneDimension[];
}

/**
 * Map from `(category, key)` → friendly chip label. Anything not in here
 * falls back to the raw key, so unusual or user-invented keys still work,
 * just with a less polished label.
 */
const FRIENDLY_LABELS: Record<string, string> = {
  "professional|employer": "Company",
  "professional|company": "Company",
  "context|works_at": "Company",
  "professional|occupation": "Profession",
  "professional|role": "Role",
  "professional|industry": "Industry",
  "professional|education": "College",
  "professional|school": "School",
  "professional|university": "College",
  "context|lives_in": "City",
  "context|city": "City",
  "context|location": "Location",
  "context|country": "Country",
  "context|met_at": "Met at",
  "context|meeting_place": "Met at",
  "lifestyle|hobby": "Hobby",
  "lifestyle|sport": "Sport",
  "preference|diet": "Diet",
};

/** Dimensions with fewer total people than this are suppressed. */
const MIN_PEOPLE_PER_DIMENSION = 2;
/** Within a dimension, zones (specific values) with fewer members than this
 *  are suppressed — keeps "Company: PwC (4 people)" but drops the 1-person
 *  long tail of every place anyone has ever worked. */
const MIN_MEMBERS_PER_ZONE = 2;

/** Lowercase + trim + collapse spaces. Stable id for value matching. */
function zoneId(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, " ");
}

export async function buildGraph(userId: string): Promise<GraphPayload> {
  // Run people, all-attributes, and all-relationships fetches in parallel.
  // The attributes call is a single batched query rather than N (one per
  // person), turning O(N) round-trips into O(1).
  const [people, all] = await Promise.all([
    listPeople(userId),
    getAllRelationships(userId),
  ]);
  const attrsByPerson = await getActiveAttributesForPeople(
    userId,
    people.map((p) => p.id),
  );

  const nodes: GraphNode[] = people.map((p) => {
    const attrs = attrsByPerson.get(p.id) ?? [];
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
  });

  const seen = new Set<string>();
  const edges: GraphEdge[] = [];
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

  const zoneDimensions = buildZoneDimensions(attrsByPerson);

  return { nodes, edges, zoneDimensions };
}

/**
 * Pure: from the per-person attribute map, derive every selectable
 * dimension (e.g. "Company", "City") and the zones inside it (e.g. "PwC",
 * "TCS" within "Company"). No SQL — runs over data we already have.
 *
 * Membership rules:
 *   - "Current" only: each person → at most one zone per dimension, picked
 *     from the highest-confidence non-superseded value (attrsByPerson is
 *     already filtered for non-superseded).
 *   - Values are matched case-insensitively after light normalization so
 *     "PwC" and "pwc" collapse into one zone. Display label uses the most
 *     common original-case spelling we've seen.
 *   - Dimensions with < MIN_PEOPLE_PER_DIMENSION people are suppressed,
 *     and within a dimension zones with < MIN_MEMBERS_PER_ZONE are dropped.
 */
function buildZoneDimensions(
  attrsByPerson: Map<string, Attribute[]>,
): GraphZoneDimension[] {
  // dimKey ("category|key") → zoneId → { label, members:Set<personId>,
  // labelCounts:Map<originalCase, count> }
  type ZoneAccumulator = {
    members: Set<string>;
    labelCounts: Map<string, number>;
  };
  const dims = new Map<string, Map<string, ZoneAccumulator>>();

  for (const [personId, attrs] of attrsByPerson) {
    // Per-person-per-dimension dedupe: if a single person has both
    // "PwC" and "pwc" we still count them once.
    const seenDimsForPerson = new Set<string>();
    // Pick the highest-confidence value per dimension for this person so
    // we honor "current" membership when there are multiple active rows.
    const best = new Map<string, Attribute>();
    for (const a of attrs) {
      const dimKey = `${a.category}|${a.key}`;
      const cur = best.get(dimKey);
      if (!cur || a.confidence > cur.confidence) best.set(dimKey, a);
    }
    for (const [dimKey, a] of best) {
      const id = zoneId(a.value);
      if (!id) continue;
      seenDimsForPerson.add(dimKey);
      let zonesForDim = dims.get(dimKey);
      if (!zonesForDim) {
        zonesForDim = new Map();
        dims.set(dimKey, zonesForDim);
      }
      let acc = zonesForDim.get(id);
      if (!acc) {
        acc = { members: new Set(), labelCounts: new Map() };
        zonesForDim.set(id, acc);
      }
      acc.members.add(personId);
      acc.labelCounts.set(
        a.value,
        (acc.labelCounts.get(a.value) ?? 0) + 1,
      );
    }
    void seenDimsForPerson;
  }

  const out: GraphZoneDimension[] = [];
  for (const [dimKey, zonesForDim] of dims) {
    const [category, key] = dimKey.split("|", 2) as [AttributeCategory, string];
    const zones: GraphZone[] = [];
    const peopleSeen = new Set<string>();
    for (const [id, acc] of zonesForDim) {
      if (acc.members.size < MIN_MEMBERS_PER_ZONE) continue;
      // Pick the most-frequent original-case spelling as the display label.
      let label = id;
      let bestCount = -1;
      for (const [original, n] of acc.labelCounts) {
        if (n > bestCount) {
          bestCount = n;
          label = original;
        }
      }
      zones.push({ id, label, memberIds: Array.from(acc.members) });
      for (const m of acc.members) peopleSeen.add(m);
    }
    if (peopleSeen.size < MIN_PEOPLE_PER_DIMENSION || zones.length === 0)
      continue;
    zones.sort((a, b) => b.memberIds.length - a.memberIds.length);
    out.push({
      id: dimKey,
      category,
      key,
      label: FRIENDLY_LABELS[dimKey] ?? toTitle(key),
      peopleCount: peopleSeen.size,
      zones,
    });
  }
  out.sort((a, b) => b.peopleCount - a.peopleCount);
  return out;
}

function toTitle(s: string): string {
  return s
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}
