import Link from "next/link";
import { ensureSchema } from "@/lib/db";
import { hasPostgres } from "@/lib/config";
import { listPeople } from "@/lib/repos/peopleRepo";
import { PeopleFilter } from "../_components/PeopleFilter";

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
  const people = await listPeople();

  return (
    <>
      <div className="mb-7 flex items-end justify-between gap-4">
        <div>
          <h1 className="m-0 text-[26px] font-bold tracking-tight">People</h1>
          <p className="mt-1 text-[13px] text-[var(--color-text-dim)]">
            {people.length} {people.length === 1 ? "person" : "people"} in your
            graph
          </p>
        </div>
      </div>

      {people.length === 0 ? (
        <EmptyState
          title="No people yet"
          body="Capture your first note to start building your graph."
          cta={
            <Link
              href="/"
              className="btn btn-primary"
              style={{ marginTop: 12, display: "inline-flex" }}
            >
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
    <div className="card text-center" style={{ padding: "40px 20px" }}>
      <h3 className="m-0 mb-2 text-[var(--color-text)]">{title}</h3>
      <p className="m-0 text-[var(--color-text-dim)]">{body}</p>
      {cta}
    </div>
  );
}
