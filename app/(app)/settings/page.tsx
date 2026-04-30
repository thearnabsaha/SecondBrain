import { Download, FileJson, FileText } from "lucide-react";
import { ensureSchema } from "@/lib/db";
import { hasPostgres } from "@/lib/config";
import { requireUser } from "@/lib/auth/current-user";
import { listPeople } from "@/lib/repos/peopleRepo";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/app/_components/ThemeToggle";
import { ProfileForm } from "@/app/_components/ProfileForm";
import { PeopleManager } from "@/app/_components/PeopleManager";
import { DangerZone } from "@/app/_components/DangerZone";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await ensureSchema();
  const user = await requireUser();
  const people = hasPostgres() ? await listPeople(user.id) : [];

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your appearance, account, and graph data.
        </p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Choose a theme. <span className="font-medium">System</span>{" "}
              follows your device&apos;s light/dark preference.
            </p>
            <ThemeToggle />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent>
            <ProfileForm user={{ name: user.name, email: user.email }} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Export your data</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Download everything: people, attributes, relationships,
              notes, and summaries. Use the JSON for backups or future
              imports; use Markdown to read offline or paste into a notes
              app.
            </p>
            <div className="flex flex-wrap gap-2">
              <a
                href="/api/export?format=json"
                download
                className={buttonVariants({ variant: "outline" })}
              >
                <FileJson className="h-4 w-4" />
                Download JSON
              </a>
              <a
                href="/api/export?format=md"
                download
                className={buttonVariants({ variant: "outline" })}
              >
                <FileText className="h-4 w-4" />
                Download Markdown
              </a>
              <span className="inline-flex items-center text-[11px] text-muted-foreground">
                <Download className="mr-1 h-3 w-3" />
                Files are generated on demand and not cached.
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>People in your graph</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              Quickly rename or delete anyone in your graph without
              opening their profile.
            </p>
            <PeopleManager
              people={people.map((p) => ({
                id: p.id,
                name: p.name,
                updated_at: p.updated_at,
              }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-destructive">Danger zone</CardTitle>
          </CardHeader>
          <CardContent>
            <DangerZone email={user.email} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
