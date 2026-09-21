import { AppNav } from "@/components/AppNav";
import { requireUser } from "@/lib/guards";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireUser();

  return (
    <div className="min-h-screen pb-16">
      <AppNav username={session.username} isAdmin={session.role === "admin"} />
      <div className="mx-auto w-full max-w-6xl px-4">{children}</div>
    </div>
  );
}
