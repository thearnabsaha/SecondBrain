import { listPeople, getAliases } from "../repos/peopleRepo";
import { getAttributesForPerson } from "../repos/attributesRepo";
import { getRelationshipsForPersonWithOther } from "../repos/relationshipsRepo";
import {
  getNotesForPerson,
  listNotes,
} from "../repos/notesRepo";
import { getSummary } from "../repos/summariesRepo";
import type { User } from "../types";

/**
 * Builds a complete, self-contained export of one user's graph. The shape
 * is stable (semver-ish via `version`) so a future "Import" feature can
 * round-trip it.
 */
export interface ExportBundle {
  version: 1;
  exported_at: string;
  user: { id: string; email: string; name: string | null };
  people: Array<{
    id: string;
    name: string;
    aliases: string[];
    created_at: string;
    updated_at: string;
    summary: { content: string; bullets: string[] | null } | null;
    attributes: Array<{
      id: string;
      category: string;
      key: string;
      value: string;
      confidence: number;
      source_note_id: string | null;
      superseded_by: string | null;
      created_at: string;
    }>;
    relationships: Array<{
      id: string;
      direction: "outgoing" | "incoming";
      type: string;
      label: string | null;
      other_id: string;
      other_name: string;
      confidence: number;
      reinforcement_count: number;
      source_note_id: string | null;
    }>;
    notes: Array<{
      id: string;
      content: string;
      created_at: string;
    }>;
  }>;
  notes_loose: Array<{
    id: string;
    content: string;
    created_at: string;
  }>;
}

/**
 * Aggregates every person + their attributes/relationships/notes/summary
 * into a single in-memory bundle. Fine for personal-scale graphs (< 10k
 * people, < 100k notes); would need pagination for anything larger.
 *
 * "notes_loose" includes every note in the user's graph that isn't tied
 * to any person — failed/pending notes, or notes that didn't extract any
 * mentions.
 */
export async function exportUserBundle(user: User): Promise<ExportBundle> {
  const people = await listPeople(user.id);

  const peopleOut = await Promise.all(
    people.map(async (p) => {
      const [aliases, attrs, relsWithOther, notes, summary] =
        await Promise.all([
          getAliases(user.id, p.id),
          getAttributesForPerson(user.id, p.id),
          getRelationshipsForPersonWithOther(user.id, p.id),
          getNotesForPerson(user.id, p.id, 1000),
          getSummary(user.id, p.id),
        ]);

      return {
        id: p.id,
        name: p.name,
        aliases,
        created_at: p.created_at,
        updated_at: p.updated_at,
        summary: summary
          ? {
              content: summary.content,
              bullets: summary.bullets
                ? summary.bullets.split("\n").filter(Boolean)
                : null,
            }
          : null,
        attributes: attrs.map((a) => ({
          id: a.id,
          category: a.category,
          key: a.key,
          value: a.value,
          confidence: a.confidence,
          source_note_id: a.source_note_id,
          superseded_by: a.superseded_by,
          created_at: a.created_at,
        })),
        relationships: relsWithOther.map((r) => ({
          id: r.id,
          direction:
            r.from_person_id === p.id ? "outgoing" : "incoming",
          type: r.type,
          label: r.label,
          other_id: r.other_id,
          other_name: r.other_name ?? "(unknown)",
          confidence: r.confidence,
          reinforcement_count: r.reinforcement_count,
          source_note_id: r.source_note_id,
        })) as ExportBundle["people"][number]["relationships"],
        notes: notes.map((n) => ({
          id: n.id,
          content: n.content,
          created_at: n.created_at,
        })),
      };
    }),
  );

  // Loose notes: every note not present in any person's `notes` array.
  const allNotes = await listNotes(user.id, 10_000);
  const linkedNoteIds = new Set<string>();
  for (const p of peopleOut) for (const n of p.notes) linkedNoteIds.add(n.id);
  const loose = allNotes
    .filter((n) => !linkedNoteIds.has(n.id))
    .map((n) => ({ id: n.id, content: n.content, created_at: n.created_at }));

  return {
    version: 1,
    exported_at: new Date().toISOString(),
    user: { id: user.id, email: user.email, name: user.name },
    people: peopleOut,
    notes_loose: loose,
  };
}

/**
 * Renders the same bundle as one self-contained Markdown document with
 * a per-person heading + table of contents. Easier to skim or paste into
 * a journal app than JSON.
 */
export function bundleToMarkdown(bundle: ExportBundle): string {
  const lines: string[] = [];
  lines.push(`# SecondBrain export — ${bundle.user.email}`);
  lines.push("");
  lines.push(`*Exported ${bundle.exported_at}*`);
  lines.push("");
  lines.push(
    `${bundle.people.length} ${bundle.people.length === 1 ? "person" : "people"}, ${bundle.notes_loose.length} loose ${bundle.notes_loose.length === 1 ? "note" : "notes"}.`,
  );
  lines.push("");

  if (bundle.people.length > 0) {
    lines.push("## Contents");
    lines.push("");
    for (const p of bundle.people) {
      lines.push(`- [${p.name}](#${slugify(p.name)})`);
    }
    lines.push("");
  }

  for (const p of bundle.people) {
    lines.push(`## ${p.name}`);
    lines.push("");
    if (p.aliases.length > 0) {
      lines.push(`*Also known as: ${p.aliases.join(", ")}*`);
      lines.push("");
    }
    if (p.summary?.bullets && p.summary.bullets.length > 0) {
      lines.push("### Bullets");
      lines.push("");
      for (const b of p.summary.bullets) lines.push(`- ${b}`);
      lines.push("");
    }
    if (p.summary?.content) {
      lines.push("### Summary");
      lines.push("");
      lines.push(p.summary.content);
      lines.push("");
    }

    const active = p.attributes.filter((a) => !a.superseded_by);
    if (active.length > 0) {
      lines.push("### Attributes");
      lines.push("");
      for (const a of active) {
        lines.push(
          `- **${a.key}**: ${a.value} *(${a.category}, conf ${(a.confidence * 100).toFixed(0)}%)*`,
        );
      }
      lines.push("");
    }

    if (p.relationships.length > 0) {
      lines.push("### Relationships");
      lines.push("");
      for (const r of p.relationships) {
        const arrow = r.direction === "outgoing" ? "→" : "←";
        lines.push(
          `- ${arrow} **${r.other_name}** *(${r.type.replace(/_/g, " ")}${r.label ? `: ${r.label}` : ""})*`,
        );
      }
      lines.push("");
    }

    if (p.notes.length > 0) {
      lines.push("### Notes");
      lines.push("");
      for (const n of p.notes) {
        lines.push(`- *${n.created_at}* — ${n.content.replace(/\n/g, " ")}`);
      }
      lines.push("");
    }
    lines.push("---");
    lines.push("");
  }

  if (bundle.notes_loose.length > 0) {
    lines.push("## Loose notes");
    lines.push("");
    lines.push(
      "*These notes aren't linked to any person — usually because extraction failed or the note didn't mention anyone.*",
    );
    lines.push("");
    for (const n of bundle.notes_loose) {
      lines.push(`- *${n.created_at}* — ${n.content.replace(/\n/g, " ")}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
