import { CreatePlusModal } from "@/components/CreatePlusModal";
import { CreateUserForm } from "@/components/CreateUserForm";
import { GlassCard } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { requireAdmin } from "@/lib/guards";
import { prisma } from "@/lib/prisma";

export default async function AdminUsersPage() {
  const session = await requireAdmin();
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      role: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="space-y-6">
      <div className="animate-in relative flex min-h-12 items-center">
        <h1 className="font-display text-4xl text-petroleum">Perfiles</h1>
        <div className="absolute right-0 top-1/2 -translate-y-1/2">
          <CreatePlusModal title="Crear perfil" ariaLabel="Crear perfil">
            <CreateUserForm />
          </CreatePlusModal>
        </div>
      </div>

      <GlassCard className="animate-in delay-1">
        <ul className="space-y-3">
          {users.map((user) => (
            <li
              key={user.id}
              className="flex flex-col gap-1 rounded-2xl bg-white/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium">
                  {user.username}
                  {user.id === session.userId ? " · vos" : ""}
                </p>
                <p className="text-sm text-muted">
                  {user.role === "admin" ? "Administración" : "Perfil privado"} · creado{" "}
                  {formatDate(user.createdAt)}
                </p>
              </div>
              <p className="text-sm text-petroleum-soft">Registros ocultos</p>
            </li>
          ))}
        </ul>
      </GlassCard>
    </main>
  );
}
