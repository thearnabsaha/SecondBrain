import { enrichPerson } from "../llm/enrich";
import { getActiveAttributes, upsertAttribute } from "../repos/attributesRepo";
import { getPersonById, touchPerson } from "../repos/peopleRepo";
import { generateSummary } from "../llm/summarize";
import { getRelationshipsForPerson } from "../repos/relationshipsRepo";
import { getNotesForPerson } from "../repos/notesRepo";
import { setSummary } from "../repos/summariesRepo";

export interface EnrichOutcome {
  query: string;
  added: number;
  attributes: Array<{
    category: string;
    key: string;
    value: string;
    confidence: number;
  }>;
  rationale: string | null;
  sources: Array<{ title: string; url: string }>;
}

function defaultQuery(
  name: string,
  attrs: Awaited<ReturnType<typeof getActiveAttributes>>,
): string {
  const employer = attrs.find(
    (a) =>
      a.category === "professional" && /employer|company|workplace/i.test(a.key),
  )?.value;
  const role = attrs.find(
    (a) => a.category === "professional" && /role|title|job/i.test(a.key),
  )?.value;
  if (employer && role) return `${role} at ${employer}`;
  if (employer) return `${employer} company overview`;
  if (role) return role;
  return `${name} public profile`;
}

export async function enrichPersonById(
  userId: string,
  personId: string,
  customQuery?: string,
): Promise<EnrichOutcome> {
  const person = await getPersonById(userId, personId);
  if (!person) throw new Error("Person not found");

  const existing = await getActiveAttributes(userId, personId);
  const query = customQuery?.trim() || defaultQuery(person.name, existing);

  const result = await enrichPerson({
    person,
    attributes: existing,
    query,
  });

  let added = 0;
  for (const attr of result.attributes) {
    const r = await upsertAttribute({
      userId,
      personId,
      category: attr.category,
      key: attr.key,
      value: attr.value,
      confidence: Math.min(0.7, attr.confidence),
      sourceNoteId: null,
    });
    if (r.added) added++;
  }

  if (added > 0) {
    await touchPerson(userId, personId);
    try {
      const attrs = await getActiveAttributes(userId, personId);
      const rels = await getRelationshipsForPerson(userId, personId);
      const notes = await getNotesForPerson(userId, personId, 10);
      const relationships = await Promise.all(
        rels.map(async (rel) => {
          const otherId =
            rel.from_person_id === personId
              ? rel.to_person_id
              : rel.from_person_id;
          const direction = rel.from_person_id === personId ? "out" : "in";
          const other = await getPersonById(userId, otherId);
          return {
            rel,
            otherName: other?.name ?? "(unknown)",
            direction: direction as "in" | "out",
          };
        }),
      );
      const summary = await generateSummary({
        person,
        attributes: attrs,
        relationships,
        recentNotes: notes,
      });
      await setSummary(userId, personId, summary.trim());
    } catch (err) {
      console.warn(
        `[enrich] summary refresh failed: ${(err as Error).message}`,
      );
    }
  }

  return {
    query,
    added,
    attributes: result.attributes,
    rationale: result.rationale,
    sources: result.sources,
  };
}
