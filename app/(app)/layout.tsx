import { requireUser } from "@/lib/auth/current-user";
import { ensureSchema } from "@/lib/db";
import { hasPostgres } from "@/lib/config";
import { countPendingForUser } from "@/lib/repos/pendingNotesRepo";
import { Sidebar } from "@/components/Sidebar";
import { HealthBanners } from "@/components/HealthBanners";
import { QuickCapture } from "@/app/_components/QuickCapture";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  // Pending-notes count for the Inbox badge in the sidebar. Best-effort:
  // if the DB hiccups we just hide the badge rather than 500 the layout.
  let pendingCount = 0;
  if (hasPostgres()) {
    try {
      await ensureSchema();
      pendingCount = await countPendingForUser(user.id);
    } catch {
      pendingCount = 0;
    }
  }

  return (
    <div className="grid min-h-screen grid-cols-[260px_1fr]">
      <Sidebar
        user={{ email: user.email, name: user.name }}
        pendingCount={pendingCount}
      />
      <main className="mx-auto w-full max-w-[1280px] px-8 pb-16 pt-8 md:px-10">
        <HealthBanners />
        {children}
      </main>
      <QuickCapture />
    </div>
  );
}
