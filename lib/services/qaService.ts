import { answerQuestion, type QaContext } from "../llm/qa";
import { listPeople, getPersonById } from "../repos/peopleRepo";
import { getActiveAttributes } from "../repos/attributesRepo";
import { getAllRelationships } from "../repos/relationshipsRepo";
import { listNotes } from "../repos/notesRepo";

async function buildQaContext(userId: string): Promise<QaContext> {
  const people = await listPeople(userId);
  const attributes = (
    await Promise.all(
      people.map((p) => getActiveAttributes(userId, p.id)),
    )
  ).flat();
  const allRels = await getAllRelationships(userId);
  const relationships = await Promise.all(
    allRels.map(async (rel) => ({
      rel,
      fromName:
        (await getPersonById(userId, rel.from_person_id))?.name ?? "(unknown)",
      toName:
        (await getPersonById(userId, rel.to_person_id))?.name ?? "(unknown)",
    })),
  );
  const notes = await listNotes(userId, 80);
  return { people, attributes, relationships, notes };
}

export async function ask(
  userId: string,
  question: string,
): Promise<{ answer: string }> {
  const ctx = await buildQaContext(userId);
  const answer = await answerQuestion(question, ctx);
  return { answer: answer.trim() };
}
