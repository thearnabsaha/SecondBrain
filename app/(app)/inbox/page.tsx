import { Inbox } from "lucide-react";
import { ensureSchema } from "@/lib/db";
import { requireUser } from "@/lib/auth/current-user";
import { listPendingForUser } from "@/lib/repos/pendingNotesRepo";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PendingItem, type PendingRow } from "@/app/_components/PendingItem";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  await ensureSchema();
  const user = await requireUser();
  const pending = await listPendingForUser(user.id);

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Notes that were saved but couldn&apos;t finish processing. Retry
          when the network or AI is back up, or discard if you don&apos;t
          want them.
        </p>
      </div>

      {pending.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Inbox className="h-8 w-8 text-muted-foreground" />
            <CardTitle>Inbox zero</CardTitle>
            <CardDescription>
              No pending notes — every note you&apos;ve captured has been
              fully processed.
            </CardDescription>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              {pending.length} pending{" "}
              {pending.length === 1 ? "note" : "notes"}
            </CardTitle>
            <CardDescription>
              These are stored safely in the database. Retrying re-runs the
              AI extraction without losing the original text.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {pending.map((p) => {
                const row: PendingRow = {
                  noteId: p.note_id,
                  content: p.content,
                  kind: p.kind,
                  reason: p.reason,
                  attempts: p.attempts,
                  createdAt: p.note_created_at,
                };
                return <PendingItem key={p.note_id} row={row} />;
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </>
  );
}
