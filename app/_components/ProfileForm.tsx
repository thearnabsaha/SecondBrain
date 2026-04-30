"use client";

import { useActionState } from "react";
import {
  changePasswordAction,
  updateProfileAction,
  type SettingsFormState,
} from "@/app/settings-actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ProfileFormProps {
  user: { name: string | null; email: string };
}

export function ProfileForm({ user }: ProfileFormProps) {
  return (
    <div className="space-y-8">
      <UpdateProfileSection user={user} />
      <ChangePasswordSection />
    </div>
  );
}

function UpdateProfileSection({ user }: ProfileFormProps) {
  const [state, formAction, pending] = useActionState<
    SettingsFormState,
    FormData
  >(updateProfileAction, null);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold">Account details</h4>
        <p className="mt-1 text-xs text-muted-foreground">
          Your display name shows up in the sidebar; your email is used to
          sign in.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="profile-name">Display name</Label>
          <Input
            id="profile-name"
            name="name"
            defaultValue={user.name ?? ""}
            placeholder="Your name"
            disabled={pending}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="profile-email">Email</Label>
          <Input
            id="profile-email"
            name="email"
            type="email"
            defaultValue={user.email}
            required
            disabled={pending}
          />
        </div>
      </div>

      {state?.ok === false && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      {state?.ok === true && (
        <Alert>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}

function ChangePasswordSection() {
  const [state, formAction, pending] = useActionState<
    SettingsFormState,
    FormData
  >(changePasswordAction, null);

  return (
    <form action={formAction} className="space-y-4 border-t pt-6">
      <div>
        <h4 className="text-sm font-semibold">Change password</h4>
        <p className="mt-1 text-xs text-muted-foreground">
          You&apos;ll need your current password to set a new one.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="current_password">Current password</Label>
        <Input
          id="current_password"
          name="current_password"
          type="password"
          autoComplete="current-password"
          required
          disabled={pending}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="new_password">New password</Label>
          <Input
            id="new_password"
            name="new_password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            disabled={pending}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm_password">Confirm new password</Label>
          <Input
            id="confirm_password"
            name="confirm_password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            disabled={pending}
          />
        </div>
      </div>

      {state?.ok === false && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      {state?.ok === true && (
        <Alert>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}
