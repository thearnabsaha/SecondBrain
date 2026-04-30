"use client";

import { useActionState, useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  deleteAccountAction,
  resetGraphAction,
  type SettingsFormState,
} from "@/app/settings-actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface DangerZoneProps {
  email: string;
}

/**
 * Two destructive actions side by side: reset graph (keep account)
 * and delete account (nuke everything). Both gate the submit button on
 * a typed confirmation phrase to prevent fat-finger accidents.
 */
export function DangerZone({ email }: DangerZoneProps) {
  return (
    <div className="space-y-6">
      <ResetGraphForm />
      <DeleteAccountForm email={email} />
    </div>
  );
}

function ResetGraphForm() {
  const [state, formAction, pending] = useActionState<
    SettingsFormState,
    FormData
  >(resetGraphAction, null);
  const [confirm, setConfirm] = useState("");
  const ready = confirm.trim() === "RESET";

  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
        <div className="flex-1 space-y-3">
          <div>
            <h4 className="text-sm font-semibold">Reset graph data</h4>
            <p className="mt-1 text-xs text-muted-foreground">
              Permanently deletes every person, note, attribute,
              relationship, alias, mention, and summary in your account.
              Your sign-in stays intact so you can start fresh. This
              cannot be undone.
            </p>
          </div>

          <form action={formAction} className="space-y-2">
            <Label htmlFor="reset-confirm" className="text-xs">
              Type{" "}
              <code className="rounded bg-destructive/10 px-1 py-px font-mono">
                RESET
              </code>{" "}
              to confirm
            </Label>
            <div className="flex gap-2">
              <Input
                id="reset-confirm"
                name="confirm"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="RESET"
                disabled={pending}
                className="h-8 max-w-[180px]"
              />
              <Button
                type="submit"
                size="sm"
                variant="destructive"
                disabled={!ready || pending}
              >
                {pending ? "Resetting…" : "Reset all my data"}
              </Button>
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
          </form>
        </div>
      </div>
    </div>
  );
}

function DeleteAccountForm({ email }: { email: string }) {
  const [state, formAction, pending] = useActionState<
    SettingsFormState,
    FormData
  >(deleteAccountAction, null);
  const [confirm, setConfirm] = useState("");
  const ready = confirm.trim().toLowerCase() === email.toLowerCase();

  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
        <div className="flex-1 space-y-3">
          <div>
            <h4 className="text-sm font-semibold">Delete account</h4>
            <p className="mt-1 text-xs text-muted-foreground">
              Permanently deletes your account and every piece of data
              attached to it. You will be signed out immediately and your
              email will be free for someone else to register. This cannot
              be undone.
            </p>
          </div>

          <form action={formAction} className="space-y-2">
            <Label htmlFor="delete-confirm" className="text-xs">
              Type your email{" "}
              <code className="rounded bg-destructive/10 px-1 py-px font-mono">
                {email}
              </code>{" "}
              to confirm
            </Label>
            <div className="flex flex-wrap gap-2">
              <Input
                id="delete-confirm"
                name="confirm"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder={email}
                disabled={pending}
                autoComplete="off"
                className="h-8 min-w-[260px] flex-1"
              />
              <Button
                type="submit"
                size="sm"
                variant="destructive"
                disabled={!ready || pending}
              >
                {pending ? "Deleting…" : "Delete my account"}
              </Button>
            </div>
            {state?.ok === false && (
              <Alert variant="destructive">
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
