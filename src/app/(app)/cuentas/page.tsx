import { AccountForm } from "@/components/AccountForm";
import { AccountsList } from "@/components/AccountsList";
import { CreatePlusModal } from "@/components/CreatePlusModal";
import { GlassCard } from "@/components/ui";
import { resolvedBank } from "@/lib/finance";
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

  const knownBanks = [
    ...new Set(
      accounts
        .map((account) => resolvedBank(account).bankName)
        .filter((name) => name.length > 0),
    ),
  ].sort((a, b) => a.localeCompare(b, "es"));

  return (
    <main className="space-y-6">
      <div className="animate-in relative flex min-h-12 items-center">
        <h1 className="font-display text-4xl text-petroleum">Cuentas</h1>
        <div className="absolute right-0 top-1/2 -translate-y-1/2">
          <CreatePlusModal title="Nueva cuenta" ariaLabel="Crear cuenta">
            <AccountForm knownBanks={knownBanks} />
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
            knownBanks={knownBanks}
            accounts={accounts.map((account) => ({
              id: account.id,
              name: account.name,
              currency: account.currency,
              purpose: account.purpose,
              tracksYield: account.tracksYield,
              bankName: account.bankName,
              bankRole: account.bankRole,
              isDefault: account.isDefault,
              transactions: account._count.transactions,
            }))}
          />
        )}
      </GlassCard>
    </main>
  );
}
