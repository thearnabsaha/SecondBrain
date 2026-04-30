"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ensureSchema } from "@/lib/db";
import { ingestNote } from "@/lib/services/ingestService";
import { enrichPersonById } from "@/lib/services/enrichService";
import { ask as askGraph } from "@/lib/services/qaService";
import {
  deletePerson as deletePersonRepo,
  renamePerson,
} from "@/lib/repos/peopleRepo";
import { deleteAttribute as deleteAttributeRepo } from "@/lib/repos/attributesRepo";
import { deleteRelationship as deleteRelationshipRepo } from "@/lib/repos/relationshipsRepo";
import type { IngestResult } from "@/lib/types";

/**
 * Server actions module.
 *
 * Every action:
 * - boots/migrates the schema lazily
 * - performs the mutation against Postgres
 * - revalidates whichever pages need a refresh
 *
 * Actions return plain JSON so they can be invoked from client forms via
 * `useFormState` or directly from `<form action={...}>`.
 */

export type IngestActionResult =
  | { ok: true; data: IngestResult }
  | { ok: false; error: string };

export async function ingestAction(
  _prev: IngestActionResult | null,
  formData: FormData,
): Promise<IngestActionResult> {
  const content = String(formData.get("content") ?? "").trim();
  if (!content) return { ok: false, error: "Note content is empty." };
  try {
    await ensureSchema();
    const result = await ingestNote(content);
    revalidatePath("/", "layout");
    return { ok: true, data: result };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function renamePersonAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) return;
  await ensureSchema();
  await renamePerson(id, name);
  revalidatePath(`/people/${id}`);
  revalidatePath("/people");
}

export async function deletePersonAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await ensureSchema();
  await deletePersonRepo(id);
  revalidatePath("/people");
  revalidatePath("/graph");
  redirect("/people");
}

export async function deleteAttributeAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const personId = String(formData.get("person_id") ?? "");
  if (!id) return;
  await ensureSchema();
  await deleteAttributeRepo(id);
  if (personId) revalidatePath(`/people/${personId}`);
}

export async function deleteRelationshipAction(
  formData: FormData,
): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const personId = String(formData.get("person_id") ?? "");
  if (!id) return;
  await ensureSchema();
  await deleteRelationshipRepo(id);
  if (personId) revalidatePath(`/people/${personId}`);
  revalidatePath("/graph");
}

export type EnrichActionResult =
  | {
      ok: true;
      data: Awaited<ReturnType<typeof enrichPersonById>>;
    }
  | { ok: false; error: string };

export async function enrichAction(
  _prev: EnrichActionResult | null,
  formData: FormData,
): Promise<EnrichActionResult> {
  const personId = String(formData.get("person_id") ?? "");
  const query = String(formData.get("query") ?? "").trim();
  if (!personId) return { ok: false, error: "person_id is required" };
  try {
    await ensureSchema();
    const data = await enrichPersonById(personId, query || undefined);
    revalidatePath(`/people/${personId}`);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export type AskActionResult =
  | { ok: true; question: string; answer: string }
  | { ok: false; error: string };

export async function askAction(
  _prev: AskActionResult | null,
  formData: FormData,
): Promise<AskActionResult> {
  const question = String(formData.get("question") ?? "").trim();
  if (!question) return { ok: false, error: "Question is empty." };
  try {
    await ensureSchema();
    const { answer } = await askGraph(question);
    return { ok: true, question, answer };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
