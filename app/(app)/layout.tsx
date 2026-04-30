import { requireUser } from "@/lib/auth/current-user";
import { Sidebar } from "@/components/Sidebar";
import { HealthBanners } from "@/components/HealthBanners";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <div className="grid min-h-screen grid-cols-[260px_1fr]">
      <Sidebar user={{ email: user.email, name: user.name }} />
      <main className="mx-auto w-full max-w-[1280px] px-8 pb-16 pt-8 md:px-10">
        <HealthBanners />
        {children}
      </main>
    </div>
  );
}
