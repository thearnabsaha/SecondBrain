import Link from "next/link";
import { ensureSchema } from "@/lib/db";
import { searchPeople } from "@/lib/services/searchService";
import { Avatar } from "@/components/Avatar";
import { SearchInput } from "../_components/SearchInput";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  await ensureSchema();
  const hits = query ? await searchPeople(query) : [];

  return (
    <>
      <div className="mb-7 flex items-end justify-between gap-4">
        <div>
          <h1 className="m-0 text-[26px] font-bold tracking-tight">Search</h1>
          <p className="mt-1 text-[13px] text-[var(--color-text-dim)]">
            Find people by name, attribute, company, hobby, or trait.
          </p>
        </div>
      </div>

      <SearchInput initialValue={query} />

      {!query && (
        <div className="card text-center" style={{ padding: "40px 20px" }}>
          <h3 className="m-0 mb-2 text-[var(--color-text)]">
            Associative recall
          </h3>
          <p className="m-0 text-[var(--color-text-dim)]">
            Search for traits, employers, locations, or hobbies — any concept
            tied to people in your graph.
          </p>
        </div>
      )}

      {query && hits.length === 0 && (
        <div className="card text-center" style={{ padding: "40px 20px" }}>
          <h3 className="m-0 mb-2 text-[var(--color-text)]">No matches</h3>
          <p className="m-0 text-[var(--color-text-dim)]">
            Nothing in your graph matched "{query}".
          </p>
        </div>
      )}

      {hits.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {hits.map((h) => (
            <Link
              key={h.person.id}
              href={`/people/${h.person.id}`}
              className="hit"
            >
              <Avatar name={h.person.name} />
              <div className="flex-1">
                <div className="font-semibold">{h.person.name}</div>
                <div className="mt-1 flex flex-wrap gap-1.5 text-[12px] text-[var(--color-text-dim)]">
                  {h.reasons.slice(0, 4).map((r, i) => (
                    <span key={i} className="tag">
                      {r}
                    </span>
                  ))}
                  {h.reasons.length > 4 && (
                    <span className="tag tag-accent">
                      +{h.reasons.length - 4} more
                    </span>
                  )}
                </div>
              </div>
              <span className="text-[12px] text-[var(--color-text-faint)]">
                score {h.score}
              </span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
