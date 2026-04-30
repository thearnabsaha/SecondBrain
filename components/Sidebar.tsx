"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  PenLine,
  Users,
  Search,
  HelpCircle,
  Network,
  LogOut,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/Avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOutAction } from "@/app/auth-actions";

const links = [
  { href: "/", label: "Capture", icon: PenLine },
  { href: "/people", label: "People", icon: Users },
  { href: "/search", label: "Search", icon: Search },
  { href: "/ask", label: "Ask", icon: HelpCircle },
  { href: "/graph", label: "Graph", icon: Network },
  { href: "/settings", label: "Settings", icon: Settings },
];

interface SidebarProps {
  user: { email: string; name: string | null };
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const displayName = user.name ?? user.email;

  return (
    <aside className="sticky top-0 flex h-screen flex-col gap-6 border-r bg-sidebar p-4">
      <div className="flex items-center gap-3 px-1 py-1">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <span className="text-sm font-bold">SB</span>
        </div>
        <div>
          <div className="text-sm font-semibold leading-tight">SecondBrain</div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            People Knowledge
          </div>
        </div>
      </div>

      <nav className="flex flex-col gap-1">
        {links.map((l) => {
          const Icon = l.icon;
          const active = isActive(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {l.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto">
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex w-full items-center gap-3 rounded-md border bg-card p-2.5 text-left transition-colors hover:bg-accent"
          >
            <Avatar name={displayName} size={32} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{displayName}</div>
              <div className="truncate text-xs text-muted-foreground">
                {user.email}
              </div>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-[var(--anchor-width)] min-w-56"
          >
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-foreground">
                  {displayName}
                </span>
                <span className="text-xs text-muted-foreground">
                  {user.email}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/settings" />}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <form action={signOutAction}>
              <DropdownMenuItem
                render={
                  <button type="submit" className="w-full cursor-pointer" />
                }
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
