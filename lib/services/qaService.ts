import { answerQuestion, type QaContext } from "../llm/qa";
import { listPeople, getPersonById } from "../repos/peopleRepo";
import { getActiveAttributes } from "../repos/attributesRepo";
import { getAllRelationships } from "../repos/relationshipsRepo";
import { listNotes } from "../repos/notesRepo";

async function buildQaContext(): Promise<QaContext> {
  const people = await listPeople();
  const attributes = (
    await Promise.all(people.map((p) => getActiveAttributes(p.id)))
  ).flat();
  const allRels = await getAllRelationships();
  const relationships = await Promise.all(
    allRels.map(async (rel) => ({
      rel,
      fromName: (await getPersonById(rel.from_person_id))?.name ?? "(unknown)",
      toName: (await getPersonById(rel.to_person_id))?.name ?? "(unknown)",
    })),
  );
  const notes = await listNotes(80);
  return { people, attributes, relationships, notes };
}

export async function ask(question: string): Promise<{ answer: string }> {
  const ctx = await buildQaContext();
  const answer = await answerQuestion(question, ctx);
  return { answer: answer.trim() };
}
