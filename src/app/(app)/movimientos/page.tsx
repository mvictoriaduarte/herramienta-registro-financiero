import { Suspense } from "react";
import { MovementsHub } from "@/components/MovementsHub";
import { ensureBnaFxRate } from "@/lib/bna-fx";
import {
  isCurrentExpense,
  monthKey,
  monthLabel,
  percentChange,
  SOURCE_COLOR_PRESETS,
  toUsd,
  transactionDisplayParts,
} from "@/lib/finance";
import { currentYearMonth } from "@/lib/format";
import { requireUser } from "@/lib/guards";
import { prisma } from "@/lib/prisma";

function expenseGroupName(category: { group: string; name: string }) {
  const group = category.group.trim();
  return group || "Sin grupo";
}

function groupColor(name: string, index: number, used: string[]) {
  const normalizedUsed = used.map((item) => item.toUpperCase());
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  const preferred =
    SOURCE_COLOR_PRESETS[(hash + index) % SOURCE_COLOR_PRESETS.length];
  if (!normalizedUsed.includes(preferred.toUpperCase())) {
    return preferred;
  }
  const available = SOURCE_COLOR_PRESETS.find(
    (color) => !normalizedUsed.includes(color.toUpperCase()),
  );
  return available ?? SOURCE_COLOR_PRESETS[index % SOURCE_COLOR_PRESETS.length];
}

export default async function TransactionsPage() {
  const session = await requireUser();
  const bnaFx = await ensureBnaFxRate();
  const now = currentYearMonth();

  const [categories, accounts, transactions] = await Promise.all([
    prisma.category.findMany({
      where: { userId: session.userId },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    }),
    prisma.account.findMany({
      where: { userId: session.userId },
      orderBy: { name: "asc" },
    }),
    prisma.transaction.findMany({
      where: { userId: session.userId },
      include: {
        category: true,
        account: true,
        refunds: { orderBy: { createdAt: "asc" } },
      },
      orderBy: { date: "desc" },
    }),
  ]);

  const expenseTx = transactions
    .filter((item) => isCurrentExpense(item.category.type))
    .map((item) => {
      const parts = transactionDisplayParts(item);
      const group = expenseGroupName(item.category);
      return {
        ...item,
        group,
        net: parts.isIncome ? 0 : parts.amount,
        year: item.date.getFullYear(),
        month: item.date.getMonth() + 1,
      };
    })
    .filter((item) => item.net > 0 || item.expenseAmount > 0);

  const groupNames = [...new Set(expenseTx.map((item) => item.group))].sort((a, b) =>
    a.localeCompare(b, "es"),
  );
  const usedGroupColors: string[] = [];
  const groups = groupNames.map((name, index) => {
    const color = groupColor(name, index, usedGroupColors);
    usedGroupColors.push(color);
    return { id: name, name, color };
  });

  const currentExpenses = expenseTx.filter(
    (item) => item.year === now.year && item.month === now.month,
  );
  const monthTotal = currentExpenses.reduce((sum, item) => sum + item.net, 0);

  const previousDate = new Date(now.year, now.month - 2, 1);
  const previousYear = previousDate.getFullYear();
  const previousMonth = previousDate.getMonth() + 1;
  const previousTotal = expenseTx
    .filter((item) => item.year === previousYear && item.month === previousMonth)
    .reduce((sum, item) => sum + item.net, 0);
  const monthChange = percentChange(monthTotal, previousTotal);

  const yearTotal = expenseTx
    .filter((item) => item.year === now.year)
    .reduce((sum, item) => sum + item.net, 0);

  const monthKeys: { year: number; month: number; key: string; label: string }[] = [];
  for (let offset = 5; offset >= 0; offset -= 1) {
    const date = new Date(now.year, now.month - 1 - offset, 1);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    monthKeys.push({
      year,
      month,
      key: monthKey(year, month),
      label: monthLabel(month).slice(0, 3),
    });
  }

  const series = groups.map((group) => ({
    id: group.id,
    name: group.name,
    color: group.color,
    values: monthKeys.map(({ year, month }) =>
      expenseTx
        .filter(
          (item) =>
            item.group === group.id && item.year === year && item.month === month,
        )
        .reduce((sum, item) => sum + item.net, 0),
    ),
  }));

  const composition = groups
    .map((group) => ({
      id: group.id,
      name: group.name,
      color: group.color,
      value: currentExpenses
        .filter((item) => item.group === group.id)
        .reduce((sum, item) => sum + item.net, 0),
    }))
    .filter((item) => item.value > 0);

  const tableRows = monthKeys.map(({ key, label, year, month }) => {
    const cells = groups.map((group) => {
      const total = expenseTx
        .filter(
          (item) =>
            item.group === group.id && item.year === year && item.month === month,
        )
        .reduce((sum, item) => sum + item.net, 0);
      return { groupId: group.id, color: group.color, total };
    });
    const rowTotal = cells.reduce((sum, cell) => sum + cell.total, 0);
    return { key, label, year, month, cells, rowTotal };
  });

  const movementItems = transactions.map((item) => ({
    id: item.id,
    incomeAmount: item.incomeAmount,
    expenseAmount: item.expenseAmount,
    amount: item.amount,
    date: item.date.toISOString(),
    note: item.note,
    currency: item.currency,
    fxRate: item.fxRate,
    categoryId: item.categoryId,
    accountId: item.accountId,
    category: {
      id: item.category.id,
      name: item.category.name,
      type: item.category.type,
      group: item.category.group,
    },
    account: item.account ? { name: item.account.name } : null,
    refunds: item.refunds.map((refund) => ({
      id: refund.id,
      amount: refund.amount,
      note: refund.note,
      date: refund.date ? refund.date.toISOString() : null,
    })),
  }));

  return (
    <Suspense fallback={<div className="text-sm text-muted">Cargando movimientos...</div>}>
      <MovementsHub
        categories={categories.map((item) => ({
          id: item.id,
          name: item.name,
          type: item.type,
        }))}
        accounts={accounts.map((item) => ({
          id: item.id,
          name: item.name,
          currency: item.currency,
          active: item.active,
          isDefault: item.isDefault,
        }))}
        transactions={movementItems}
        bnaFx={bnaFx}
        consolidated={{
          monthTotal,
          monthUsd: toUsd(monthTotal, bnaFx?.sell ?? null),
          monthChange,
          yearTotal,
          groupCount: composition.length,
          year: now.year,
          months: monthKeys.map(({ key, label }) => ({ key, label })),
          series,
          composition,
          tableRows,
          groups,
        }}
      />
    </Suspense>
  );
}
