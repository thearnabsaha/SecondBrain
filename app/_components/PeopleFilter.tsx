"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { Input } from "@/components/ui/input";

interface PersonLite {
  id: string;
  name: string;
  updated_at: string;
}

interface Props {
  people: PersonLite[];
}

export function PeopleFilter({ people }: Props) {
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return people;
    return people.filter((p) => p.name.toLowerCase().includes(f));
  }, [filter, people]);

  return (
    <>
      <div className="mb-5 flex justify-end">
        <Input
          className="max-w-xs"
          placeholder="Filter by name…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((p) => (
          <Link
            key={p.id}
            href={`/people/${p.id}`}
            className="flex items-center gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-accent"
          >
            <Avatar name={p.name} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{p.name}</div>
              <div className="text-xs text-muted-foreground">
                Updated {formatDate(p.updated_at)}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString();
}
