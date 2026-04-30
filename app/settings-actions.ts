"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ensureSchema } from "@/lib/db";
import { requireUser } from "@/lib/auth/current-user";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { SESSION_CONFIG } from "@/lib/auth/session";
import {
  deletePerson as deletePersonRepo,
  renamePerson as renamePersonRepo,
} from "@/lib/repos/peopleRepo";
import {
  deleteUser,
  findUserByEmail,
  getPasswordHash,
  updateUserPassword,
  updateUserProfile,
  wipeUserGraph,
} from "@/lib/repos/usersRepo";

/**
 * Settings page server actions: profile / password / reset / delete account.
 *
 * All destructive actions require an explicit confirmation phrase from the
 * client to make accidental clicks harmless.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type SettingsFormState =
  | { ok: true; message: string }
  | { ok: false; error: string }
  | null;

export async function updateProfileAction(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: "Please enter a valid email address." };
  }

  try {
    await ensureSchema();
    const user = await requireUser();

    if (email !== user.email) {
      const existing = await findUserByEmail(email);
      if (existing && existing.user.id !== user.id) {
        return {
          ok: false,
          error: "Another account already uses that email address.",
        };
      }
    }

    await updateUserProfile(user.id, {
      name: name.length > 0 ? name : null,
      email,
    });

    revalidatePath("/", "layout");
    return { ok: true, message: "Profile updated." };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function changePasswordAction(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const current = String(formData.get("current_password") ?? "");
  const next = String(formData.get("new_password") ?? "");
  const confirm = String(formData.get("confirm_password") ?? "");

  if (next.length < 8) {
    return {
      ok: false,
      error: "New password must be at least 8 characters.",
    };
  }
  if (next !== confirm) {
    return { ok: false, error: "New password and confirmation don't match." };
  }

  try {
    await ensureSchema();
    const user = await requireUser();
    const hash = await getPasswordHash(user.id);
    if (!hash) return { ok: false, error: "Account not found." };

    const ok = await verifyPassword(current, hash);
    if (!ok) return { ok: false, error: "Current password is incorrect." };

    const newHash = await hashPassword(next);
    await updateUserPassword(user.id, newHash);
    return { ok: true, message: "Password changed." };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/**
 * Wipes every person, note, attribute, relationship, alias, mention,
 * and summary owned by the current user. Account stays.
 *
 * Requires the client to send `confirm=RESET` so a misclick does nothing.
 */
export async function resetGraphAction(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const confirm = String(formData.get("confirm") ?? "");
  if (confirm !== "RESET") {
    return {
      ok: false,
      error: "Type RESET to confirm wiping all your data.",
    };
  }

  try {
    await ensureSchema();
    const user = await requireUser();
    await wipeUserGraph(user.id);
    revalidatePath("/", "layout");
    return { ok: true, message: "Your graph has been reset." };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/**
 * Hard-deletes the account (and all data via FK CASCADE), clears the
 * session cookie, and redirects to /signin. Requires the user to type
 * their email as confirmation.
 */
export async function deleteAccountAction(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const confirm = String(formData.get("confirm") ?? "")
    .trim()
    .toLowerCase();

  let userIdToDelete: string;
  try {
    await ensureSchema();
    const user = await requireUser();

    if (confirm !== user.email.toLowerCase()) {
      return {
        ok: false,
        error: "Type your email exactly to confirm account deletion.",
      };
    }
    userIdToDelete = user.id;
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }

  // Delete + clear cookie outside the try so a redirect-throw isn't swallowed.
  await deleteUser(userIdToDelete);
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_CONFIG.cookie);

  redirect("/signin");
}

/**
 * Rename a person from the settings management table. Same effect as
 * the profile-page rename, but revalidates /settings as well.
 */
export async function renamePersonFromSettingsAction(
  formData: FormData,
): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) return;
  await ensureSchema();
  const user = await requireUser();
  await renamePersonRepo(user.id, id, name);
  revalidatePath("/settings");
  revalidatePath("/people");
  revalidatePath(`/people/${id}`);
  revalidatePath("/graph");
}

/**
 * Delete a person from the settings management table without redirecting
 * away from /settings (the existing deletePersonAction sends users to
 * /people, which is wrong here).
 */
export async function deletePersonFromSettingsAction(
  formData: FormData,
): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await ensureSchema();
  const user = await requireUser();
  await deletePersonRepo(user.id, id);
  revalidatePath("/settings");
  revalidatePath("/people");
  revalidatePath("/graph");
}
