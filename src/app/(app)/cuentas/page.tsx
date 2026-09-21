import { AccountForm } from "@/components/AccountForm";
import { AccountsList } from "@/components/AccountsList";
import { CreatePlusModal } from "@/components/CreatePlusModal";
import { GlassCard } from "@/components/ui";
import { requireUser } from "@/lib/guards";
import { prisma } from "@/lib/prisma";

export default async function AccountsPage() {
  const session = await requireUser();
  const accounts = await prisma.account.findMany({
    where: { userId: session.userId },
    include: {
      _count: { select: { transactions: true, balances: true } },
    },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });

  return (
    <main className="space-y-6">
      <div className="animate-in relative flex min-h-12 items-center">
        <h1 className="font-display text-4xl text-petroleum">Cuentas</h1>
        <div className="absolute right-0 top-1/2 -translate-y-1/2">
          <CreatePlusModal title="Nueva cuenta" ariaLabel="Crear cuenta">
            <AccountForm />
          </CreatePlusModal>
        </div>
      </div>

      <GlassCard className="animate-in delay-1">
        {accounts.length === 0 ? (
          <p className="text-sm text-muted">
            Agregá cajas, billeteras o fondos (Santander, Mercado Pago, Efectivo…).
          </p>
        ) : (
          <AccountsList
            accounts={accounts.map((account) => ({
              id: account.id,
              name: account.name,
              currency: account.currency,
              purpose: account.purpose,
              isDefault: account.isDefault,
              transactions: account._count.transactions,
            }))}
          />
        )}
      </GlassCard>
    </main>
  );
}
