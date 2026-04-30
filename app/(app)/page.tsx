import Link from "next/link";
import { Clock } from "lucide-react";
import { ensureSchema } from "@/lib/db";
import { hasPostgres } from "@/lib/config";
import { requireUser } from "@/lib/auth/current-user";
import { getStalePeople } from "@/lib/repos/peopleRepo";
import { Avatar } from "@/components/Avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CapturePanel } from "../_components/CapturePanel";

export const dynamic = "force-dynamic";

const examples = [
  "Met Aarav at the gym today. He works at TCS, doesn't smoke, and seems super disciplined about his routine. Mentioned his girlfriend Maya is a doctor.",
  "Riya is Aarav's cousin. She's into climbing and photography. Studying at IIT Bombay.",
  "Caught up with Maya — she's switched hospitals, now at AIIMS. Loves dogs. Vegetarian.",
  "Karthik is my new manager at work. Lives in Bangalore. Plays guitar on weekends.",
];

const STALE_AFTER_DAYS = 30;

export default async function CapturePage() {
  // Stale-connections widget: people you haven't mentioned in 30+ days.
  // Best-effort — if the DB hiccups we just hide the widget rather than
  // 500 the home page.
  let stale: Awaited<ReturnType<typeof getStalePeople>> = [];
  if (hasPostgres()) {
    try {
      await ensureSchema();
      const user = await requireUser();
      stale = await getStalePeople(user.id, STALE_AFTER_DAYS, 5);
    } catch {
      stale = [];
    }
  }

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Capture</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Drop in messy notes about people you know. The system will extract,
          connect, and remember.
        </p>
      </div>

      <CapturePanel examples={examples} />

      {stale.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Haven&apos;t talked about
            </CardTitle>
            <CardDescription>
              People in your graph you haven&apos;t mentioned in{" "}
              {STALE_AFTER_DAYS}+ days. Maybe drop a note?
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {stale.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <Avatar name={p.name} size={36} />
                  <Link
                    href={`/people/${p.id}`}
                    className="min-w-0 flex-1 hover:opacity-80"
                  >
                    <div className="truncate text-sm font-medium">
                      {p.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {p.days_stale}{" "}
                      {p.days_stale === 1 ? "day" : "days"} since last mention
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </>
  );
}
