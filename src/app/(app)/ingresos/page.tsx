import { Suspense } from "react";
import { IncomeHub } from "@/components/IncomeHub";
import { ensureBnaFxRate, resolveFxRate } from "@/lib/bna-fx";
import {
  computeIncomeTotal,
  monthKey,
  monthLabel,
  percentChange,
  toUsd,
} from "@/lib/finance";
import { currentYearMonth } from "@/lib/format";
import { requireUser } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import type { BillingMode } from "@/lib/types";

export default async function IncomeHubPage() {
  const session = await requireUser();
  const now = currentYearMonth();
  const bnaFx = await ensureBnaFxRate();

  const [sources, periods] = await Promise.all([
    prisma.incomeSource.findMany({
      where: { userId: session.userId },
      orderBy: { name: "asc" },
    }),
    prisma.incomePeriod.findMany({
      where: { userId: session.userId },
      include: {
        source: true,
        adjustments: true,
      },
      orderBy: [{ year: "asc" }, { month: "asc" }],
    }),
  ]);

  const enriched = periods.map((period) => {
    const total = computeIncomeTotal(
      period.source.billingMode as BillingMode,
      {
        units: period.units,
        unitValue: period.unitValue,
        fixedAmount: period.fixedAmount,
      },
      period.adjustments,
    );
    return { ...period, total };
  });

  const currentMonth = enriched.filter(
    (item) => item.year === now.year && item.month === now.month,
  );
  const monthTotal = currentMonth.reduce((sum, item) => sum + item.total, 0);

  const previousDate = new Date(now.year, now.month - 2, 1);
  const previousYear = previousDate.getFullYear();
  const previousMonth = previousDate.getMonth() + 1;
  const previousTotal = enriched
    .filter((item) => item.year === previousYear && item.month === previousMonth)
    .reduce((sum, item) => sum + item.total, 0);
  const monthChange = percentChange(monthTotal, previousTotal);

  const yearTotal = enriched
    .filter((item) => item.year === now.year)
    .reduce((sum, item) => sum + item.total, 0);

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

  const series = sources.map((source) => ({
    id: source.id,
    name: source.name,
    color: source.color,
    values: monthKeys.map(({ year, month }) =>
      enriched
        .filter(
          (item) =>
            item.sourceId === source.id && item.year === year && item.month === month,
        )
        .reduce((sum, item) => sum + item.total, 0),
    ),
  }));

  const composition = sources.map((source) => ({
    id: source.id,
    name: source.name,
    color: source.color,
    value: currentMonth
      .filter((item) => item.sourceId === source.id)
      .reduce((sum, item) => sum + item.total, 0),
  }));

  const tableRows = monthKeys.map(({ year, month, key, label }) => {
    const cells = sources.map((source) => {
      const total = enriched
        .filter(
          (item) =>
            item.sourceId === source.id && item.year === year && item.month === month,
        )
        .reduce((sum, item) => sum + item.total, 0);
      return { sourceId: source.id, color: source.color, total };
    });
    const rowTotal = cells.reduce((sum, cell) => sum + cell.total, 0);
    return { key, label, year, month, cells, rowTotal };
  });

  const fallbackFx = bnaFx?.sell ?? null;
  const avgFx =
    sources
      .map((source) => resolveFxRate(source.defaultFxRate, bnaFx))
      .filter((rate): rate is number => typeof rate === "number" && rate > 0)
      .reduce((sum, rate, _, arr) => sum + rate / arr.length, 0) || fallbackFx;

  const sourceCards = sources.map((source) => {
    const sourceMonth = currentMonth
      .filter((item) => item.sourceId === source.id)
      .reduce((sum, item) => sum + item.total, 0);
    const fx = resolveFxRate(source.defaultFxRate, bnaFx);
    return {
      id: source.id,
      name: source.name,
      color: source.color,
      logoUrl: source.logoUrl,
      billingMode: source.billingMode,
      defaultFxRate: source.defaultFxRate,
      monthTotal: sourceMonth,
      monthUsd: toUsd(sourceMonth, fx),
    };
  });

  return (
    <Suspense fallback={<div className="text-sm text-muted">Cargando ingresos...</div>}>
      <IncomeHub
        sources={sourceCards}
        usedColors={sources.map((source) => source.color)}
        bnaFx={bnaFx}
        consolidated={{
          monthTotal,
          monthUsd: toUsd(monthTotal, avgFx),
          monthChange,
          yearTotal,
          sourceCount: sources.length,
          year: now.year,
          months: monthKeys.map(({ key, label }) => ({ key, label })),
          series,
          composition,
          tableRows,
          sources: sources.map((source) => ({
            id: source.id,
            name: source.name,
            color: source.color,
          })),
        }}
      />
    </Suspense>
  );
}
