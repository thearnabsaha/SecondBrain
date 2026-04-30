"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Pencil, Trash2, Check, X, Search, ExternalLink } from "lucide-react";
import {
  deletePersonFromSettingsAction,
  renamePersonFromSettingsAction,
} from "@/app/settings-actions";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface PersonRow {
  id: string;
  name: string;
  updated_at: string;
}

interface PeopleManagerProps {
  people: PersonRow[];
}

/**
 * Inline-editable people table for the Settings page. Each row supports:
 *   - rename (pencil → text input → save/cancel)
 *   - delete (trash → row turns red, asks "type the name to delete")
 *
 * Filter input narrows the visible rows. Server actions revalidate
 * /settings, /people, /graph; the table re-renders automatically.
 */
export function PeopleManager({ people }: PeopleManagerProps) {
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return people;
    return people.filter((p) => p.name.toLowerCase().includes(q));
  }, [people, filter]);

  if (people.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        You don&apos;t have any people in your graph yet. Capture a note to
        get started.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={`Filter ${people.length} ${
            people.length === 1 ? "person" : "people"
          }…`}
          className="pl-9"
        />
      </div>

      <div className="overflow-hidden rounded-md border">
        <ul role="list" className="divide-y">
          {filtered.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-muted-foreground">
              No matches.
            </li>
          ) : (
            filtered.map((p) => <PersonRowItem key={p.id} person={p} />)
          )}
        </ul>
      </div>
    </div>
  );
}

function PersonRowItem({ person }: { person: PersonRow }) {
  const [mode, setMode] = useState<"view" | "edit" | "confirm-delete">("view");
  const [draftName, setDraftName] = useState(person.name);
  const [confirmText, setConfirmText] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSave() {
    const next = draftName.trim();
    if (!next || next === person.name) {
      setMode("view");
      setDraftName(person.name);
      return;
    }
    const fd = new FormData();
    fd.set("id", person.id);
    fd.set("name", next);
    startTransition(async () => {
      await renamePersonFromSettingsAction(fd);
      setMode("view");
    });
  }

  function handleDelete() {
    const fd = new FormData();
    fd.set("id", person.id);
    startTransition(async () => {
      await deletePersonFromSettingsAction(fd);
    });
  }

  if (mode === "edit") {
    return (
      <li className="flex items-center gap-3 px-4 py-3">
        <Avatar name={person.name} size={32} />
        <Input
          autoFocus
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") {
              setMode("view");
              setDraftName(person.name);
            }
          }}
          disabled={pending}
          className="h-8 flex-1"
        />
        <Button
          size="icon-sm"
          variant="default"
          onClick={handleSave}
          disabled={pending || !draftName.trim()}
          aria-label="Save name"
        >
          <Check className="h-4 w-4" />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => {
            setMode("view");
            setDraftName(person.name);
          }}
          disabled={pending}
          aria-label="Cancel"
        >
          <X className="h-4 w-4" />
        </Button>
      </li>
    );
  }

  if (mode === "confirm-delete") {
    const matches = confirmText.trim() === person.name;
    return (
      <li className="flex items-center gap-3 bg-destructive/5 px-4 py-3">
        <Avatar name={person.name} size={32} />
        <div className="min-w-0 flex-1">
          <div className="text-xs text-destructive">
            Type{" "}
            <code className="rounded bg-destructive/10 px-1 py-px font-mono">
              {person.name}
            </code>{" "}
            to permanently delete this person and all their notes,
            attributes, and relationships.
          </div>
          <Input
            autoFocus
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={person.name}
            disabled={pending}
            className="mt-2 h-8"
          />
        </div>
        <Button
          size="sm"
          variant="destructive"
          onClick={handleDelete}
          disabled={pending || !matches}
        >
          {pending ? "Deleting…" : "Delete"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setMode("view");
            setConfirmText("");
          }}
          disabled={pending}
        >
          Cancel
        </Button>
      </li>
    );
  }

  return (
    <li
      className={cn(
        "flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40",
        pending && "opacity-50",
      )}
    >
      <Avatar name={person.name} size={32} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{person.name}</div>
        <div className="text-xs text-muted-foreground">
          Updated {formatRelative(person.updated_at)}
        </div>
      </div>
      <Link
        href={`/people/${person.id}`}
        className="text-muted-foreground hover:text-foreground"
        aria-label={`Open ${person.name}'s profile`}
        title="Open profile"
      >
        <ExternalLink className="h-4 w-4" />
      </Link>
      <Button
        size="icon-sm"
        variant="ghost"
        onClick={() => setMode("edit")}
        aria-label={`Rename ${person.name}`}
        title="Rename"
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        onClick={() => setMode("confirm-delete")}
        aria-label={`Delete ${person.name}`}
        title="Delete"
        className="text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </li>
  );
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diff = Date.now() - then;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}
