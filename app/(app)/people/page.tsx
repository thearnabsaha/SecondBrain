import Link from "next/link";
import { ensureSchema } from "@/lib/db";
import { hasPostgres } from "@/lib/config";
import { listPeople } from "@/lib/repos/peopleRepo";
import { requireUser } from "@/lib/auth/current-user";
import { PeopleFilter } from "../../_components/PeopleFilter";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function PeoplePage() {
  if (!hasPostgres()) {
    return (
      <EmptyState
        title="Postgres not configured"
        body="Set POSTGRES_URL in .env.local to start tracking people."
      />
    );
  }

  await ensureSchema();
  const user = await requireUser();
  const people = await listPeople(user.id);

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">People</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {people.length} {people.length === 1 ? "person" : "people"} in your
          graph
        </p>
      </div>

      {people.length === 0 ? (
        <EmptyState
          title="No people yet"
          body="Capture your first note to start building your graph."
          cta={
            <Link href="/" className={buttonVariants({ className: "mt-4" })}>
              Capture a note
            </Link>
          }
        />
      ) : (
        <PeopleFilter
          people={people.map((p) => ({
            id: p.id,
            name: p.name,
            updated_at: p.updated_at,
          }))}
        />
      )}
    </>
  );
}

function EmptyState({
  title,
  body,
  cta,
}: {
  title: string;
  body: string;
  cta?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center py-16 text-center">
        <h3 className="text-lg font-medium">{title}</h3>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">{body}</p>
        {cta}
      </CardContent>
    </Card>
  );
}
