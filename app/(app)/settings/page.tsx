import { ensureSchema } from "@/lib/db";
import { hasPostgres } from "@/lib/config";
import { requireUser } from "@/lib/auth/current-user";
import { listPeople } from "@/lib/repos/peopleRepo";
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
