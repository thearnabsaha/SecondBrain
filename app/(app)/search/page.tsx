import Link from "next/link";
import { ensureSchema } from "@/lib/db";
import { requireUser } from "@/lib/auth/current-user";
import { searchPeople } from "@/lib/services/searchService";
import { Avatar } from "@/components/Avatar";
import { SearchInput } from "../../_components/SearchInput";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  await ensureSchema();
  const user = await requireUser();
  const hits = query ? await searchPeople(user.id, query) : [];

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Search</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Find people by name, attribute, company, hobby, or trait.
        </p>
      </div>

      <SearchInput initialValue={query} />

      {!query && (
        <Card>
          <CardContent className="py-14 text-center">
            <h3 className="text-lg font-medium">Associative recall</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Search for traits, employers, locations, or hobbies — any concept
              tied to people in your graph.
            </p>
          </CardContent>
        </Card>
      )}

      {query && hits.length === 0 && (
        <Card>
          <CardContent className="py-14 text-center">
            <h3 className="text-lg font-medium">No matches</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Nothing in your graph matched &quot;{query}&quot;.
            </p>
          </CardContent>
        </Card>
      )}

      {hits.length > 0 && (
        <div className="space-y-2.5">
          {hits.map((h) => (
            <Link
              key={h.person.id}
              href={`/people/${h.person.id}`}
              className="flex items-center gap-4 rounded-lg border bg-card px-4 py-3 transition-colors hover:bg-accent"
            >
              <Avatar name={h.person.name} />
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{h.person.name}</div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {h.reasons.slice(0, 4).map((r, i) => (
                    <Badge key={i} variant="secondary" className="font-normal">
                      {r}
                    </Badge>
                  ))}
                  {h.reasons.length > 4 && (
                    <Badge variant="outline">
                      +{h.reasons.length - 4} more
                    </Badge>
                  )}
                </div>
              </div>
              <span className="text-xs text-muted-foreground">
                score {h.score}
              </span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
