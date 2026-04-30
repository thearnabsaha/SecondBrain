import Link from "next/link";
import { notFound } from "next/navigation";
import { Trash2, X } from "lucide-react";
import { ensureSchema } from "@/lib/db";
import { requireUser } from "@/lib/auth/current-user";
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
} from "../../../actions";
import { EnrichPanel } from "../../../_components/EnrichPanel";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  const user = await requireUser();
  const person = await getPersonById(user.id, id);
  if (!person) notFound();

  const [active, all, rels, notes, aliases, summary] = await Promise.all([
    getActiveAttributes(user.id, id),
    getAttributesForPerson(user.id, id),
    getRelationshipsForPerson(user.id, id),
    getNotesForPerson(user.id, id, 100),
    getAliases(user.id, id),
    getSummary(user.id, id),
  ]);

  const hydratedRelationships = await Promise.all(
    rels.map(async (rel) => {
      const isOutgoing = rel.from_person_id === id;
      const otherId = isOutgoing ? rel.to_person_id : rel.from_person_id;
      const other = await getPersonById(user.id, otherId);
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
          <h1 className="text-2xl font-semibold tracking-tight">
            {person.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {active.length} attributes · {hydratedRelationships.length}{" "}
            relationships · {notes.length} notes
            {aliases.length > 0 && (
              <>
                {" · "}
                also known as {aliases.join(", ")}
              </>
            )}
          </p>
        </div>
        <form action={deletePersonAction}>
          <input type="hidden" name="id" value={person.id} />
          <Button type="submit" variant="ghost" size="sm">
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </form>
      </div>

      <div className="mt-6 grid grid-cols-1 items-start gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent>
              {summary ? (
                <p className="summary-text m-0">{summary.content}</p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Summary will appear here after the first ingest finishes
                  processing.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Attributes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {active.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No attributes yet.
                </p>
              ) : (
                CATEGORY_ORDER.map((cat) => {
                  const list = grouped[cat];
                  if (!list || list.length === 0) return null;
                  return (
                    <div key={cat} className="space-y-2">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {CATEGORY_LABELS[cat]}
                      </div>
                      {list.map((a) => (
                        <div
                          key={a.id}
                          className="flex items-center gap-3 rounded-md border bg-muted/30 px-3 py-2"
                        >
                          <span className="text-sm font-medium">{a.key}</span>
                          <span className="ml-2 flex-1 text-right text-sm text-muted-foreground">
                            {a.value}
                          </span>
                          <div
                            className="confidence-bar"
                            title={`confidence ${(a.confidence * 100).toFixed(0)}%`}
                          >
                            <span
                              style={{ width: `${a.confidence * 100}%` }}
                            />
                          </div>
                          <form action={deleteAttributeAction}>
                            <input type="hidden" name="id" value={a.id} />
                            <input
                              type="hidden"
                              name="person_id"
                              value={person.id}
                            />
                            <Button
                              type="submit"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              aria-label="Remove attribute"
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </form>
                        </div>
                      ))}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {history.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Superseded facts</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-3 text-xs text-muted-foreground">
                  Older values that were replaced by newer information. Kept
                  for history.
                </p>
                <div className="space-y-1">
                  {history.map((a) => (
                    <div key={a.id} className="history-row">
                      [{a.category}] {a.key}: {a.value} ·{" "}
                      {formatDate(a.created_at)}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-5">
          <EnrichPanel personId={person.id} personName={person.name} />

          <Card>
            <CardHeader>
              <CardTitle>Relationships</CardTitle>
            </CardHeader>
            <CardContent>
              {hydratedRelationships.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No relationships recorded.
                </p>
              ) : (
                <div className="space-y-2">
                  {hydratedRelationships.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2"
                    >
                      <Link
                        href={`/people/${r.other.id}`}
                        className="flex flex-1 items-center gap-3 hover:opacity-80"
                      >
                        <Avatar name={r.other.name} size={36} />
                        <div className="min-w-0">
                          <div className="text-sm font-medium">
                            {r.other.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {r.direction === "outgoing" ? "→ " : "← "}
                            {r.type.replace(/_/g, " ")}
                            {r.label ? ` (${r.label})` : ""}
                          </div>
                        </div>
                      </Link>
                      <form action={deleteRelationshipAction}>
                        <input type="hidden" name="id" value={r.id} />
                        <input
                          type="hidden"
                          name="person_id"
                          value={person.id}
                        />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          aria-label="Remove relationship"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </form>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {notes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No notes yet.</p>
              ) : (
                <div className="space-y-2.5">
                  {notes.map((n) => (
                    <div key={n.id} className="timeline-item">
                      <span className="mb-1 block text-[11px] text-muted-foreground">
                        {formatDate(n.created_at)}
                      </span>
                      {n.content}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
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
