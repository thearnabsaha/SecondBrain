"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Avatar } from "@/components/Avatar";

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
        <input
          className="input"
          style={{ maxWidth: 280 }}
          placeholder="Filter by name…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((p) => (
          <Link key={p.id} href={`/people/${p.id}`} className="person-card">
            <div className="flex items-center gap-3">
              <Avatar name={p.name} />
              <div>
                <h3 className="m-0 text-[15px] font-semibold">{p.name}</h3>
                <div className="text-[12px] text-[var(--color-text-faint)]">
                  Updated {formatDate(p.updated_at)}
                </div>
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
