import Link from "next/link";
import { notFound } from "next/navigation";
import { ensureSchema } from "@/lib/db";
import {
  getAliases,
  getPersonById,
} from "@/lib/repos/peopleRepo";
import {
  getActiveAttributes,
  getAttributesForPerson,
} from "@/lib/repos/attributesRepo";
import { getRelationshipsForPerson } from "@/lib/repos/relationshipsRepo";
import { getNotesForPerson } from "@/lib/repos/notesRepo";
import { getSummary } from "@/lib/repos/summariesRepo";
import { Avatar } from "@/components/Avatar";
import {
  deleteAttributeAction,
  deletePersonAction,
  deleteRelationshipAction,
} from "../../actions";
import { EnrichPanel } from "../../_components/EnrichPanel";
import type { Attribute, AttributeCategory } from "@/lib/types";

export const dynamic = "force-dynamic";

const CATEGORY_LABELS: Record<AttributeCategory, string> = {
  professional: "Professional",
  personality: "Personality",
  lifestyle: "Lifestyle",
  preference: "Preferences",
  life_event: "Life Events",
  context: "Context",
  physical: "Physical",
  skill: "Skills",
  contact: "Contact",
  other: "Other",
};

const CATEGORY_ORDER: AttributeCategory[] = [
  "professional",
  "personality",
  "lifestyle",
  "preference",
  "life_event",
  "context",
  "skill",
  "physical",
  "contact",
  "other",
];

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  await ensureSchema();
  const person = await getPersonById(id);
  if (!person) notFound();

  const [active, all, rels, notes, aliases, summary] = await Promise.all([
    getActiveAttributes(id),
    getAttributesForPerson(id),
    getRelationshipsForPerson(id),
    getNotesForPerson(id, 100),
    getAliases(id),
    getSummary(id),
  ]);

  const hydratedRelationships = await Promise.all(
    rels.map(async (rel) => {
      const isOutgoing = rel.from_person_id === id;
      const otherId = isOutgoing ? rel.to_person_id : rel.from_person_id;
      const other = await getPersonById(otherId);
      return {
        ...rel,
        direction: (isOutgoing ? "outgoing" : "incoming") as
          | "outgoing"
          | "incoming",
        other: other
          ? { id: other.id, name: other.name }
          : { id: otherId, name: "(unknown)" },
      };
    }),
  );

  const history = all.filter((a) => a.superseded_by);
  const grouped = groupByCategory(active);

  return (
    <>
      <div className="flex items-center gap-4">
        <Avatar name={person.name} size={72} />
        <div className="flex-1">
          <h1 className="m-0 text-[28px] font-bold tracking-tight">
            {person.name}
          </h1>
          <div className="mt-1 text-[13px] text-[var(--color-text-dim)]">
            {active.length} attributes · {hydratedRelationships.length}{" "}
            relationships · {notes.length} notes
            {aliases.length > 0 && (
              <>
                {" · "}
                also known as {aliases.join(", ")}
              </>
            )}
          </div>
        </div>
        <form action={deletePersonAction}>
          <input type="hidden" name="id" value={person.id} />
          <button type="submit" className="btn btn-danger">
            Delete
          </button>
        </form>
      </div>

      <div className="mt-5 grid grid-cols-1 items-start gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-4">
          <div className="card">
            <div className="card-title">Summary</div>
            {summary ? (
              <p className="summary-text m-0">{summary.content}</p>
            ) : (
              <p className="m-0 text-[13px] text-[var(--color-text-dim)]">
                Summary will appear here after the first ingest finishes
                processing.
              </p>
            )}
          </div>

          <div className="card">
            <div className="card-title">Attributes</div>
            {active.length === 0 ? (
              <p className="m-0 text-[13px] text-[var(--color-text-dim)]">
                No attributes yet.
              </p>
            ) : (
              CATEGORY_ORDER.map((cat) => {
                const list = grouped[cat];
                if (!list || list.length === 0) return null;
                return (
                  <div key={cat} className="mb-4 flex flex-col gap-1.5 last:mb-0">
                    <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--color-text-faint)]">
                      {CATEGORY_LABELS[cat]}
                    </div>
                    {list.map((a) => (
                      <div key={a.id} className="attribute-row">
                        <span className="text-[13px] font-medium">{a.key}</span>
                        <span className="ml-2.5 mr-2.5 flex-1 text-right text-[13px] text-[var(--color-text-dim)]">
                          {a.value}
                        </span>
                        <div
                          className="confidence-bar mr-2.5"
                          title={`confidence ${(a.confidence * 100).toFixed(0)}%`}
                        >
                          <span style={{ width: `${a.confidence * 100}%` }} />
                        </div>
                        <form action={deleteAttributeAction}>
                          <input type="hidden" name="id" value={a.id} />
                          <input
                            type="hidden"
                            name="person_id"
                            value={person.id}
                          />
                          <button
                            type="submit"
                            className="btn btn-ghost"
                            style={{ padding: "4px 8px", fontSize: 12 }}
                            aria-label="Remove attribute"
                          >
                            ×
                          </button>
                        </form>
                      </div>
                    ))}
                  </div>
                );
              })
            )}
          </div>

          {history.length > 0 && (
            <div className="card">
              <div className="card-title">Superseded facts</div>
              <p
                className="text-[12px] text-[var(--color-text-faint)]"
                style={{ marginTop: -8 }}
              >
                Older values that were replaced by newer information. Kept for
                history.
              </p>
              {history.map((a) => (
                <div key={a.id} className="history-row">
                  [{a.category}] {a.key}: {a.value}{" "}
                  <span className="text-[var(--color-text-faint)]">
                    · {formatDate(a.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <EnrichPanel personId={person.id} personName={person.name} />

          <div className="card">
            <div className="card-title">Relationships</div>
            {hydratedRelationships.length === 0 ? (
              <p className="m-0 text-[13px] text-[var(--color-text-dim)]">
                No relationships recorded.
              </p>
            ) : (
              hydratedRelationships.map((r) => (
                <div key={r.id} className="relationship-row">
                  <Link
                    href={`/people/${r.other.id}`}
                    className="flex flex-1 items-center gap-2.5"
                  >
                    <Avatar name={r.other.name} />
                    <div>
                      <div className="text-[14px] font-medium">
                        {r.other.name}
                      </div>
                      <div className="text-[11px] text-[var(--color-text-faint)]">
                        {r.direction === "outgoing" ? "→ " : "← "}
                        {r.type.replace(/_/g, " ")}
                        {r.label ? ` (${r.label})` : ""}
                      </div>
                    </div>
                  </Link>
                  <form action={deleteRelationshipAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="person_id" value={person.id} />
                    <button
                      type="submit"
                      className="btn btn-ghost"
                      style={{ padding: "4px 8px", fontSize: 12 }}
                      aria-label="Remove relationship"
                    >
                      ×
                    </button>
                  </form>
                </div>
              ))
            )}
          </div>

          <div className="card">
            <div className="card-title">Timeline</div>
            {notes.length === 0 ? (
              <p className="m-0 text-[13px] text-[var(--color-text-dim)]">
                No notes yet.
              </p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {notes.map((n) => (
                  <div key={n.id} className="timeline-item">
                    <span className="mb-1 block text-[11px] text-[var(--color-text-faint)]">
                      {formatDate(n.created_at)}
                    </span>
                    {n.content}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function groupByCategory(
  attrs: Attribute[],
): Partial<Record<AttributeCategory, Attribute[]>> {
  const out: Partial<Record<AttributeCategory, Attribute[]>> = {};
  for (const a of attrs) {
    if (!out[a.category]) out[a.category] = [];
    out[a.category]!.push(a);
  }
  return out;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}
