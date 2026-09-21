import Link from "next/link";
import { GlassCard } from "@/components/ui";
import {
  computeIncomeTotal,
  isCurrentExpense,
  isInternalMovement,
  monthLabel,
  transactionDisplayParts,
} from "@/lib/finance";
import {
  currentYearMonth,
  endOfMonth,
  formatDate,
  formatMoney,
  startOfMonth,
} from "@/lib/format";
import { requireUser } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import type { BillingMode } from "@/lib/types";

export default async function DashboardPage() {
  const session = await requireUser();
  const { year, month } = currentYearMonth();
  const from = startOfMonth();
  const to = endOfMonth();

  const [monthTransactions, recent, incomePeriods, balances, allYearTx] =
    await Promise.all([
      prisma.transaction.findMany({
        where: {
          userId: session.userId,
          date: { gte: from, lte: to },
        },
        include: { category: true, account: true, refunds: true },
      }),
      prisma.transaction.findMany({
        where: { userId: session.userId },
        include: { category: true, account: true, refunds: true },
        orderBy: { date: "desc" },
        take: 6,
      }),
      prisma.incomePeriod.findMany({
        where: { userId: session.userId, year, month },
        include: { source: true, adjustments: true },
      }),
      prisma.accountBalance.findMany({
        where: { userId: session.userId, year, month },
      }),
      prisma.transaction.findMany({
        where: {
          userId: session.userId,
          date: {
            gte: new Date(year, month - 7, 1),
            lte: new Date(year, month, 0, 23, 59, 59, 999),
          },
        },
        include: { category: true, refunds: true },
      }),
    ]);

  const professionalIncome = incomePeriods.reduce((sum, period) => {
    return (
      sum +
      computeIncomeTotal(
        period.source.billingMode as BillingMode,
        {
          units: period.units,
          unitValue: period.unitValue,
          fixedAmount: period.fixedAmount,
        },
        period.adjustments,
      )
    );
  }, 0);

  const movementIncome = monthTransactions.reduce((sum, item) => {
    const parts = transactionDisplayParts(item);
    return sum + (parts.isIncome ? parts.amount : 0);
  }, 0);
  const currentExpenses = monthTransactions.reduce((sum, item) => {
    if (!isCurrentExpense(item.category.type)) {
      return sum;
    }
    const parts = transactionDisplayParts(item);
    return sum + (parts.isIncome ? 0 : parts.amount);
  }, 0);
  const savingsOut = monthTransactions.reduce((sum, item) => {
    if (item.category.type !== "savings") {
      return sum;
    }
    const parts = transactionDisplayParts(item);
    return sum + (parts.isIncome ? 0 : parts.amount);
  }, 0);
  const internalOut = monthTransactions.reduce((sum, item) => {
    if (!isInternalMovement(item.category.type)) {
      return sum;
    }
    const parts = transactionDisplayParts(item);
    return sum + (parts.isIncome ? 0 : parts.amount);
  }, 0);

  const honorarios = professionalIncome > 0 ? professionalIncome : movementIncome;
  const availableFlow = honorarios - currentExpenses;
  const savingsRate = honorarios > 0 ? availableFlow / honorarios : 0;

  const rankingMap = new Map<string, number>();
  for (const item of monthTransactions) {
    if (!isCurrentExpense(item.category.type)) {
      continue;
    }
    const parts = transactionDisplayParts(item);
    if (parts.isIncome || parts.amount <= 0) {
      continue;
    }
    rankingMap.set(
      item.category.name,
      (rankingMap.get(item.category.name) ?? 0) + parts.amount,
    );
  }
  const ranking = [...rankingMap.entries()]
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  const evolution = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(year, month - 1 - (5 - index), 1);
    const y = date.getFullYear();
    const m = date.getMonth() + 1;
    const monthStart = new Date(y, m - 1, 1);
    const monthEnd = new Date(y, m, 0, 23, 59, 59, 999);
    const txs = allYearTx.filter(
      (item) => item.date >= monthStart && item.date <= monthEnd,
    );
    const expenses = txs.reduce((sum, item) => {
      if (!isCurrentExpense(item.category.type)) {
        return sum;
      }
      const parts = transactionDisplayParts(item);
      return sum + (parts.isIncome ? 0 : parts.amount);
    }, 0);
    const income = txs.reduce((sum, item) => {
      const parts = transactionDisplayParts(item);
      return sum + (parts.isIncome ? parts.amount : 0);
    }, 0);
    return {
      key: `${y}-${m}`,
      label: monthLabel(m).slice(0, 3),
      expenses,
      income,
      flow: income - expenses,
    };
  });

  const maxBar = Math.max(
    ...evolution.flatMap((item) => [item.expenses, item.income, Math.abs(item.flow)]),
    1,
  );

  const endHoldingsArs = balances
    .filter((item) => item.kind === "end")
    .reduce((sum, item) => sum + item.amountArs, 0);

  return (
    <main className="space-y-6">
      <div className="animate-in">
        <h1 className="font-display text-4xl text-petroleum">Análisis financiero</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <GlassCard className="animate-in delay-1">
          <p className="text-sm text-muted">Honorarios / ingresos</p>
          <p className="mt-3 font-display text-3xl text-petroleum">
            {formatMoney(honorarios)}
          </p>
        </GlassCard>
        <GlassCard className="animate-in delay-2">
          <p className="text-sm text-muted">Gastos corrientes</p>
          <p className="mt-3 font-display text-3xl text-petroleum">
            {formatMoney(currentExpenses)}
          </p>
        </GlassCard>
        <GlassCard className="animate-in delay-3">
          <p className="text-sm text-muted">Flujo disponible</p>
          <p className="mt-3 font-display text-3xl text-petroleum">
            {formatMoney(availableFlow)}
          </p>
        </GlassCard>
        <GlassCard className="animate-in delay-4">
          <p className="text-sm text-muted">Tasa de ahorro potencial</p>
          <p className="mt-3 font-display text-3xl text-petroleum">
            {(savingsRate * 100).toFixed(1)}%
          </p>
        </GlassCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <GlassCard className="animate-in delay-2">
          <p className="text-sm text-muted">Ahorro / inversión (salidas)</p>
          <p className="mt-3 font-display text-2xl text-petroleum">
            {formatMoney(savingsOut)}
          </p>
        </GlassCard>
        <GlassCard className="animate-in delay-3">
          <p className="text-sm text-muted">Movimientos internos / neutros</p>
          <p className="mt-3 font-display text-2xl text-petroleum">
            {formatMoney(internalOut)}
          </p>
        </GlassCard>
        <GlassCard className="animate-in delay-4">
          <p className="text-sm text-muted">Tenencias fin de mes (ARS)</p>
          <p className="mt-3 font-display text-2xl text-petroleum">
            {formatMoney(endHoldingsArs)}
          </p>
          <Link href="/tenencias" className="mt-2 inline-block text-sm text-petroleum-soft">
            Ver tenencias
          </Link>
        </GlassCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <GlassCard className="animate-in delay-3">
          <h2 className="mb-5 font-display text-2xl text-petroleum">
            Ranking de gastos del mes
          </h2>
          {ranking.length === 0 ? (
            <p className="text-sm text-muted">Todavía no hay gastos corrientes este mes.</p>
          ) : (
            <ul className="space-y-3">
              {ranking.map((item, index) => {
                const width = Math.max(8, (item.total / ranking[0].total) * 100);
                return (
                  <li key={item.name}>
                    <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium">
                        {index + 1}. {item.name}
                      </span>
                      <span className="text-petroleum">{formatMoney(item.total)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/50">
                      <div
                        className="h-full rounded-full bg-petroleum transition-all duration-700"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </GlassCard>

        <GlassCard className="animate-in delay-4">
          <h2 className="mb-5 font-display text-2xl text-petroleum">Evolución reciente</h2>
          <div className="flex h-48 items-end gap-3">
            {evolution.map((item) => (
              <div key={item.key} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex h-36 w-full items-end justify-center gap-1">
                  <div
                    className="w-2 rounded-t-full bg-petroleum/30"
                    style={{ height: `${(item.income / maxBar) * 100}%` }}
                    title={`Ingresos ${formatMoney(item.income)}`}
                  />
                  <div
                    className="w-2 rounded-t-full bg-petroleum"
                    style={{ height: `${(item.expenses / maxBar) * 100}%` }}
                    title={`Gastos ${formatMoney(item.expenses)}`}
                  />
                </div>
                <span className="text-xs capitalize text-muted">{item.label}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted">
            Barras claras: ingresos en movimientos · oscuras: gastos corrientes
          </p>
        </GlassCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <GlassCard className="animate-in delay-5">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="font-display text-2xl text-petroleum">Últimos movimientos</h2>
            <Link href="/movimientos" className="text-sm font-medium text-petroleum-soft">
              Ver todos
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="text-sm text-muted">Todavía no cargaste nada en este perfil.</p>
          ) : (
            <ul className="space-y-3">
              {recent.map((item) => {
                const { isIncome, amount } = transactionDisplayParts(item);
                return (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-4 rounded-2xl bg-white/40 px-4 py-3"
                  >
                    <div>
                      <p className="font-medium text-ink">{item.category.name}</p>
                      <p className="text-sm text-muted">
                        {formatDate(item.date)} · {item.account?.name ?? "Sin cuenta"}
                        {item.note ? ` · ${item.note}` : ""}
                      </p>
                    </div>
                    <p className="font-semibold text-petroleum">
                      {isIncome ? "+" : "-"}
                      {formatMoney(amount, item.currency as "ARS" | "USD")}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </GlassCard>

        <GlassCard className="animate-in delay-5 space-y-4">
          <h2 className="font-display text-2xl text-petroleum">Accesos</h2>
          <div className="flex flex-col gap-3">
            <Link
              href="/movimientos"
              className="rounded-2xl bg-petroleum px-4 py-3 text-sm font-semibold text-white"
            >
              Cargar movimiento
            </Link>
            <Link
              href="/ingresos"
              className="rounded-2xl bg-white/50 px-4 py-3 text-sm font-semibold text-petroleum"
            >
              Honorarios del mes
            </Link>
            <Link
              href="/cuentas"
              className="rounded-2xl bg-white/50 px-4 py-3 text-sm font-semibold text-petroleum"
            >
              Cuentas / orígenes
            </Link>
          </div>
          {session.role === "admin" ? (
            <p className="text-sm leading-6 text-muted">
              Como admin podés crear perfiles, pero no abrir sus registros.
            </p>
          ) : null}
        </GlassCard>
      </div>
    </main>
  );
}
