import { notFound } from "next/navigation";
import {
  deleteIncomeAdjustmentAction,
  deleteIncomePeriodAction,
} from "@/actions/income";
import { CreatePlusModal } from "@/components/CreatePlusModal";
import { DeleteButton } from "@/components/DeleteButton";
import { RateSparkline } from "@/components/IncomeCharts";
import {
  IncomeAdjustmentForm,
  IncomePeriodForm,
} from "@/components/IncomeForms";
import { SourceHeader } from "@/components/SourceHeader";
import { GlassCard } from "@/components/ui";
import { ensureBnaFxRate, resolveFxRate } from "@/lib/bna-fx";
import {
  computeIncomeTotal,
  formatPercent,
  monthLabel,
  percentChange,
  toUsd,
  billingValueLabel,
} from "@/lib/finance";
import { formatMoney } from "@/lib/format";
import { requireUser } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { type BillingMode } from "@/lib/types";

type PageProps = {
  params: Promise<{ sourceId: string }>;
};

export default async function IncomeSourcePage({ params }: PageProps) {
  const session = await requireUser();
  const { sourceId } = await params;
  const bnaFx = await ensureBnaFxRate();

  const source = await prisma.incomeSource.findFirst({
    where: { id: sourceId, userId: session.userId },
  });

  if (!source) {
    notFound();
  }

  const periods = await prisma.incomePeriod.findMany({
    where: { userId: session.userId, sourceId: source.id },
    include: { adjustments: { orderBy: { name: "asc" } } },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });

  const mode = source.billingMode as BillingMode;
  const fx = resolveFxRate(source.defaultFxRate, bnaFx);
  const rows = periods.map((period) => {
    const total = computeIncomeTotal(
      mode,
      {
        units: period.units,
        unitValue: period.unitValue,
        fixedAmount: period.fixedAmount,
      },
      period.adjustments,
    );
    const base =
      mode === "monthly"
        ? period.fixedAmount ?? 0
        : (period.units ?? 0) * (period.unitValue ?? 0);
    const rate =
      mode === "monthly"
        ? period.fixedAmount ?? 0
        : period.unitValue ?? 0;
    return { period, total, base, rate };
  });

  const chronological = [...rows].reverse();
  const latest = rows[0];
  const previous = rows[1];
  const evolution = percentChange(latest?.total ?? 0, previous?.total ?? 0);
  const latestUsd = toUsd(latest?.total ?? 0, fx);
  const rateValues = chronological.map((item) => item.rate).filter((value) => value > 0);

  return (
    <main className="space-y-6">
      <SourceHeader source={source} bnaSell={bnaFx?.sell ?? null} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <GlassCard className="animate-in delay-1">
          <p className="text-sm text-muted">Último período</p>
          <p className="mt-3 font-display text-3xl" style={{ color: source.color }}>
            {latest ? formatMoney(latest.total) : "—"}
          </p>
          {latest ? (
            <p className="mt-1 text-sm capitalize text-muted">
              {monthLabel(latest.period.month)} {latest.period.year}
            </p>
          ) : null}
        </GlassCard>
        <GlassCard className="animate-in delay-2">
          <p className="text-sm text-muted">{billingValueLabel(mode)}</p>
          <p className="mt-3 font-display text-3xl text-petroleum">
            {latest ? formatMoney(latest.rate) : "—"}
          </p>
        </GlassCard>
        <GlassCard className="animate-in delay-3">
          <p className="text-sm text-muted">Evolución vs. anterior</p>
          <p className="mt-3 font-display text-3xl text-petroleum">
            {formatPercent(evolution)}
          </p>
        </GlassCard>
        <GlassCard className="animate-in delay-4">
          <p className="text-sm text-muted">Equivalente USD</p>
          <p className="mt-3 font-display text-3xl text-petroleum">
            {latestUsd !== null ? formatMoney(latestUsd, "USD") : "—"}
          </p>
          <p className="mt-1 text-sm text-muted">
            {source.defaultFxRate
              ? `TC manual ${source.defaultFxRate.toLocaleString("es-AR")}`
              : bnaFx
                ? `TC BNA venta ${bnaFx.sell.toLocaleString("es-AR")}`
                : "Sin TC disponible"}
          </p>
        </GlassCard>
      </div>

      <GlassCard className="animate-in delay-2">
        <h2 className="mb-5 font-display text-2xl text-petroleum">Evolución de tarifa</h2>
        <RateSparkline values={rateValues} color={source.color} />
        <p className="mt-3 text-sm text-muted">
          {mode === "hourly"
            ? "Muestra el valor hora cargado mes a mes."
            : mode === "monthly"
              ? "Muestra el monto mensual fijo en el tiempo."
              : mode === "project"
                ? "Muestra el valor por proyecto en el tiempo."
                : "Muestra el valor por período según la modalidad."}
        </p>
      </GlassCard>

      <GlassCard className="animate-in delay-3 overflow-x-auto">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="font-display text-2xl text-petroleum">Ingresos mes a mes</h2>
          <CreatePlusModal title="Registrar período" ariaLabel="Registrar período">
            <IncomePeriodForm
              sourceId={source.id}
              billingMode={source.billingMode}
              accentColor={source.color}
            />
          </CreatePlusModal>
        </div>
        {rows.length === 0 ? (
          <p className="text-sm text-muted">Todavía no cargaste períodos en esta fuente.</p>
        ) : (
          <table className="min-w-full border-separate border-spacing-y-2 text-sm">
            <thead>
              <tr className="text-left text-muted">
                <th className="px-3 py-2">Período</th>
                <th className="px-3 py-2">Detalle</th>
                <th className="px-3 py-2">Total ARS</th>
                <th className="px-3 py-2">USD</th>
                <th className="px-3 py-2">Δ %</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const older = rows[index + 1];
                const change = percentChange(row.total, older?.total ?? 0);
                const usd = toUsd(row.total, fx);
                const detail =
                  mode === "monthly"
                    ? `Fijo ${formatMoney(row.base)}`
                    : `${row.period.units ?? 0} × ${formatMoney(row.period.unitValue ?? 0)}`;

                return (
                  <tr key={row.period.id} className="bg-white/40">
                    <td className="rounded-l-2xl px-3 py-3 capitalize">
                      {monthLabel(row.period.month)} {row.period.year}
                    </td>
                    <td className="px-3 py-3 text-muted">{detail}</td>
                    <td className="px-3 py-3 font-semibold" style={{ color: source.color }}>
                      {formatMoney(row.total)}
                    </td>
                    <td className="px-3 py-3">
                      {usd !== null ? formatMoney(usd, "USD") : "—"}
                    </td>
                    <td className="px-3 py-3">{formatPercent(older ? change : null)}</td>
                    <td className="rounded-r-2xl px-3 py-3">
                      <DeleteButton action={deleteIncomePeriodAction} id={row.period.id} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </GlassCard>

      {rows.map((row) => (
        <GlassCard key={`adj-${row.period.id}`} className="animate-in delay-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl text-petroleum">
                Adicionales · {monthLabel(row.period.month)} {row.period.year}
              </h2>
              <p className="mt-1 text-sm text-muted">
                Base {formatMoney(row.base)} · Neto {formatMoney(row.total)}
              </p>
            </div>
            <CreatePlusModal
              title={`Adicional · ${monthLabel(row.period.month)} ${row.period.year}`}
              ariaLabel="Sumar adicional"
            >
              <IncomeAdjustmentForm
                periodId={row.period.id}
                accentColor={source.color}
              />
            </CreatePlusModal>
          </div>
          {row.period.adjustments.length > 0 ? (
            <ul className="space-y-2">
              {row.period.adjustments.map((adj) => (
                <li
                  key={adj.id}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-white/40 px-4 py-3 text-sm"
                >
                  <span>{adj.name}</span>
                  <span className="flex items-center gap-3">
                    {formatMoney(adj.amount)}
                    <DeleteButton
                      action={deleteIncomeAdjustmentAction}
                      id={adj.id}
                      label="×"
                    />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Sin adicionales en este período.</p>
          )}
        </GlassCard>
      ))}
    </main>
  );
}
