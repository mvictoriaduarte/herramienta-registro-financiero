import { BalanceForm } from "@/components/BalanceForm";
import { CreatePlusModal } from "@/components/CreatePlusModal";
import { HoldingAccountRow } from "@/components/HoldingAccountRow";
import { GlassCard } from "@/components/ui";
import { ensureBnaFxRate } from "@/lib/bna-fx";
import { computeLiveHolding, mondaysInMonth, shiftDays, toDateKey } from "@/lib/finance";
import { currentYearMonth, formatMoney, startOfMonth } from "@/lib/format";
import { requireUser } from "@/lib/guards";
import { prisma } from "@/lib/prisma";

export default async function HoldingsPage() {
  const session = await requireUser();
  const now = currentYearMonth();
  const bnaFx = await ensureBnaFxRate();
  const prevMonth = now.month === 1 ? 12 : now.month - 1;
  const prevYear = now.month === 1 ? now.year - 1 : now.year;
  const mondays = mondaysInMonth(now.year, now.month);
  const lookback = mondays[0] ? shiftDays(mondays[0], -7) : startOfMonth();

  const [accounts, monthBalances, prevEnds, weeklySnapshots, transactions] =
    await Promise.all([
      prisma.account.findMany({
        where: { userId: session.userId },
        orderBy: { name: "asc" },
      }),
      prisma.accountBalance.findMany({
        where: {
          userId: session.userId,
          year: now.year,
          month: now.month,
        },
      }),
      prisma.accountBalance.findMany({
        where: {
          userId: session.userId,
          year: prevYear,
          month: prevMonth,
          kind: "end",
        },
      }),
      prisma.accountWeeklySnapshot.findMany({
        where: {
          userId: session.userId,
          weekDate: { gte: toDateKey(lookback) },
        },
      }),
      prisma.transaction.findMany({
        where: {
          userId: session.userId,
          date: { gte: lookback },
        },
        include: { category: true, refunds: true },
      }),
    ]);

  const startArs = monthBalances
    .filter((item) => item.kind === "start")
    .reduce((sum, item) => sum + item.amountArs, 0);
  const startUsd = monthBalances
    .filter((item) => item.kind === "start")
    .reduce((sum, item) => sum + item.amountUsd, 0);

  const rows = accounts.map((account) => {
    const records = monthBalances.filter((item) => item.accountId === account.id);
    const start = records.find((item) => item.kind === "start") ?? null;
    const end = records.find((item) => item.kind === "end") ?? null;
    const live = computeLiveHolding({
      account,
      start,
      end,
      prevEnd: prevEnds.find((item) => item.accountId === account.id) ?? null,
      weekly: weeklySnapshots.filter((item) => item.accountId === account.id),
      transactions: transactions.filter((item) => item.accountId === account.id),
      year: now.year,
      month: now.month,
      fx: bnaFx,
    });
    return { account, current: live };
  });

  const liveArs = rows.reduce((sum, row) => sum + (row.current?.amountArs ?? 0), 0);
  const liveUsd = rows.reduce((sum, row) => sum + (row.current?.amountUsd ?? 0), 0);

  return (
    <main className="space-y-6">
      <div className="animate-in relative flex min-h-12 items-center">
        <div>
          <h1 className="font-display text-4xl text-petroleum">Tenencias</h1>
          {bnaFx ? (
            <p className="mt-1 text-sm text-muted">
              TC BNA compra{" "}
              {bnaFx.buy.toLocaleString("es-AR", { minimumFractionDigits: 2 })} · venta{" "}
              {bnaFx.sell.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
            </p>
          ) : null}
        </div>
        <div className="absolute right-0 top-1/2 -translate-y-1/2">
          <CreatePlusModal title="Cargar tenencia" ariaLabel="Cargar tenencia">
            <BalanceForm
              accounts={accounts}
              bnaFx={bnaFx}
              defaults={{ year: now.year, month: now.month }}
            />
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
          <p className="text-sm text-muted">Actual (ARS)</p>
          <p className="mt-3 font-display text-3xl text-petroleum">{formatMoney(liveArs)}</p>
          <p className="mt-2 text-sm text-muted">
            Diferencia ARS {formatMoney(liveArs - startArs)} · USD{" "}
            {formatMoney(liveUsd - startUsd, "USD")}
          </p>
        </GlassCard>
      </div>

      <GlassCard className="animate-in delay-3">
        <h2 className="mb-5 font-display text-2xl text-petroleum">Cuentas</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-muted">Creá una cuenta para ver tenencias.</p>
        ) : (
          <ul className="space-y-3">
            {rows.map(({ account, current }) => (
              <HoldingAccountRow key={account.id} account={account} current={current} />
            ))}
          </ul>
        )}
      </GlassCard>
    </main>
  );
}
