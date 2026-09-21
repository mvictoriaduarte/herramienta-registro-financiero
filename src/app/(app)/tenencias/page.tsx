import { deleteAccountBalanceAction } from "@/actions/balances";
import { BalanceForm } from "@/components/BalanceForm";
import { CreatePlusModal } from "@/components/CreatePlusModal";
import { DeleteButton } from "@/components/DeleteButton";
import { GlassCard } from "@/components/ui";
import { monthLabel } from "@/lib/finance";
import { currentYearMonth, formatMoney } from "@/lib/format";
import { requireUser } from "@/lib/guards";
import { prisma } from "@/lib/prisma";

export default async function HoldingsPage() {
  const session = await requireUser();
  const now = currentYearMonth();

  const [accounts, balances] = await Promise.all([
    prisma.account.findMany({
      where: { userId: session.userId },
      orderBy: { name: "asc" },
    }),
    prisma.accountBalance.findMany({
      where: { userId: session.userId },
      include: { account: true },
      orderBy: [{ year: "desc" }, { month: "desc" }, { kind: "asc" }],
    }),
  ]);

  const current = balances.filter(
    (item) => item.year === now.year && item.month === now.month,
  );

  const startArs = current
    .filter((item) => item.kind === "start")
    .reduce((sum, item) => sum + item.amountArs, 0);
  const endArs = current
    .filter((item) => item.kind === "end")
    .reduce((sum, item) => sum + item.amountArs, 0);
  const startUsd = current
    .filter((item) => item.kind === "start")
    .reduce((sum, item) => sum + item.amountUsd, 0);
  const endUsd = current
    .filter((item) => item.kind === "end")
    .reduce((sum, item) => sum + item.amountUsd, 0);

  return (
    <main className="space-y-6">
      <div className="animate-in relative flex min-h-12 items-center">
        <h1 className="font-display text-4xl text-petroleum">Tenencias</h1>
        <div className="absolute right-0 top-1/2 -translate-y-1/2">
          <CreatePlusModal title="Cargar tenencia" ariaLabel="Cargar tenencia">
            <BalanceForm accounts={accounts} />
          </CreatePlusModal>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <GlassCard className="animate-in delay-1">
          <p className="text-sm text-muted">Inicio del mes (ARS)</p>
          <p className="mt-3 font-display text-3xl text-petroleum">{formatMoney(startArs)}</p>
          <p className="mt-2 text-sm text-muted">USD {formatMoney(startUsd, "USD")}</p>
        </GlassCard>
        <GlassCard className="animate-in delay-2">
          <p className="text-sm text-muted">Fin del mes (ARS)</p>
          <p className="mt-3 font-display text-3xl text-petroleum">{formatMoney(endArs)}</p>
          <p className="mt-2 text-sm text-muted">
            Diferencia ARS {formatMoney(endArs - startArs)} · USD{" "}
            {formatMoney(endUsd - startUsd, "USD")}
          </p>
        </GlassCard>
      </div>

      <GlassCard className="animate-in delay-3">
        <h2 className="mb-5 font-display text-2xl text-petroleum">Historial</h2>
        {balances.length === 0 ? (
          <p className="text-sm text-muted">
            Registrá el saldo de cada cuenta al inicio y al fin del mes.
          </p>
        ) : (
          <ul className="space-y-3">
            {balances.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-3 rounded-2xl bg-white/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">{item.account.name}</p>
                  <p className="text-sm text-muted">
                    {monthLabel(item.month)} {item.year} ·{" "}
                    {item.kind === "start" ? "Inicio" : "Fin"}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <p className="text-sm font-semibold text-petroleum">
                    {formatMoney(item.amountArs)} · {formatMoney(item.amountUsd, "USD")}
                  </p>
                  <DeleteButton action={deleteAccountBalanceAction} id={item.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>
    </main>
  );
}
