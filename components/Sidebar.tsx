"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Capture", icon: "✎" },
  { href: "/people", label: "People", icon: "◉" },
  { href: "/search", label: "Search", icon: "⌕" },
  { href: "/ask", label: "Ask", icon: "?" },
  { href: "/graph", label: "Graph", icon: "◇" },
];

export function Sidebar() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <aside
      className="sticky top-0 flex h-screen flex-col gap-6 border-r border-[var(--color-border)] p-[18px_18px_24px] [background:linear-gradient(180deg,var(--color-bg-1),var(--color-bg-0))]"
    >
      <div className="flex items-center gap-3 p-1 font-bold tracking-tight">
        <div
          className="relative h-9 w-9 rounded-[10px] [background:linear-gradient(135deg,var(--color-accent),var(--color-accent-2))] [box-shadow:0_6px_24px_rgba(124,92,255,0.35)] before:absolute before:inset-1 before:rounded-[8px] before:[background:radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.6),transparent_40%),rgba(0,0,0,0.15)]"
        />
        <div>
          <div className="text-[16px] leading-tight">SecondBrain</div>
          <div className="text-[11px] uppercase tracking-[0.05em] text-[var(--color-text-faint)]">
            People Knowledge
          </div>
        </div>
      </div>

      <nav className="mt-1 flex flex-col gap-1">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="nav-link"
            data-active={isActive(l.href)}
          >
            <span className="dot" />
            <span className="w-[18px] text-center opacity-70">{l.icon}</span>
            <span>{l.label}</span>
          </Link>
        ))}
      </nav>

      <div className="mt-auto text-[11px] leading-relaxed text-[var(--color-text-faint)]">
        Local-first second brain.
        <br />
        Notes never leave your machine
        <br />
        except to call your LLM.
      </div>
    </aside>
  );
}
