"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { IconPencil } from "@/components/ActionIcons";
import { CreatePlusModal } from "@/components/CreatePlusModal";
import { CreateSourceButton } from "@/components/CreateSourceButton";
import { IncomeBarChart, IncomeCompositionChart } from "@/components/IncomeCharts";
import { IncomeSourceSettingsForm } from "@/components/IncomeForms";
import { SlidingTabs } from "@/components/SlidingTabs";
import { SourceAvatar } from "@/components/SourceAvatar";
import { GlassCard } from "@/components/ui";
import { formatPercent } from "@/lib/finance";
import { formatMoney } from "@/lib/format";
import { BILLING_MODE_LABELS, type BillingMode } from "@/lib/types";

type SourceCard = {
  id: string;
  name: string;
  color: string;
  logoUrl?: string | null;
  billingMode: string;
  defaultFxRate: number | null;
  monthTotal: number;
  monthUsd: number | null;
};

type ConsolidatedProps = {
  monthTotal: number;
  monthUsd: number | null;
  monthChange: number | null;
  yearTotal: number;
  sourceCount: number;
  year: number;
  months: { key: string; label: string }[];
  series: { id: string; name: string; color: string; values: number[] }[];
  composition: { id: string; name: string; color: string; value: number }[];
  tableRows: {
    key: string;
    label: string;
    year: number;
    cells: { sourceId: string; color: string; total: number }[];
    rowTotal: number;
  }[];
  sources: { id: string; name: string; color: string }[];
};

export function IncomeHub({
  sources,
  usedColors,
  consolidated,
  bnaFx,
}: {
  sources: SourceCard[];
  usedColors: string[];
  consolidated: ConsolidatedProps;
  bnaFx?: { date: string; buy: number; sell: number; source: string } | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get("vista") === "consolidado" ? "consolidado" : "fuentes";

  function setTab(next: "fuentes" | "consolidado") {
    const url = next === "consolidado" ? "/ingresos?vista=consolidado" : "/ingresos";
    router.replace(url);
  }

  return (
    <main className="space-y-6">
      <div className="animate-in delay-1 relative flex min-h-12 items-center justify-center">
        <h1 className="absolute left-0 top-1/2 font-display text-3xl text-petroleum -translate-y-1/2 sm:text-4xl">
          Ingresos
        </h1>
        <SlidingTabs
          tabs={
            [
              { id: "fuentes", label: "Fuentes" },
              { id: "consolidado", label: "Vista consolidada" },
            ] as const
          }
          value={tab}
          onChange={setTab}
        />
        <div className="absolute right-0 top-1/2 -translate-y-1/2">
          <CreateSourceButton usedColors={usedColors} bnaSell={bnaFx?.sell ?? null} />
        </div>
      </div>
      {bnaFx ? (
        <p className="text-sm text-muted">
          TC BNA venta {bnaFx.sell.toLocaleString("es-AR", { minimumFractionDigits: 2 })} ·{" "}
          {bnaFx.date.split("-").reverse().join("/")}
        </p>
      ) : null}

      {tab === "fuentes" ? (
        <section className="animate-in delay-2">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sources.map((source) => (
              <div
                key={source.id}
                className="group relative overflow-hidden rounded-[24px] border border-white/70 bg-white/45 p-5 transition duration-500 hover:-translate-y-1 hover:bg-white/70"
              >
                <div
                  className="absolute inset-x-0 top-0 h-1.5"
                  style={{ backgroundColor: source.color }}
                />
                <div className="absolute right-3 top-4 z-10">
                  <CreatePlusModal
                    title="Editar fuente"
                    ariaLabel={`Editar ${source.name}`}
                    trigger={<IconPencil />}
                  >
                    <IncomeSourceSettingsForm
                      source={{
                        id: source.id,
                        name: source.name,
                        billingMode: source.billingMode,
                        color: source.color,
                        logoUrl: source.logoUrl,
                        defaultFxRate: source.defaultFxRate,
                      }}
                      bnaSell={bnaFx?.sell ?? null}
                    />
                  </CreatePlusModal>
                </div>
                <Link href={`/ingresos/${source.id}`} className="block">
                  <div className="mb-4 flex items-center justify-between gap-3 pr-10">
                    <SourceAvatar
                      name={source.name}
                      color={source.color}
                      logoUrl={source.logoUrl}
                    />
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                      Entrar
                    </span>
                  </div>
                  <h2 className="font-display text-2xl text-petroleum">{source.name}</h2>
                  <p className="mt-1 text-sm text-muted">
                    {BILLING_MODE_LABELS[source.billingMode as BillingMode] ??
                      source.billingMode}
                  </p>
                  <p className="mt-4 font-semibold" style={{ color: source.color }}>
                    {formatMoney(source.monthTotal)}
                  </p>
                  {source.monthUsd !== null ? (
                    <p className="text-sm text-muted">
                      {formatMoney(source.monthUsd, "USD")}
                    </p>
                  ) : (
                    <p className="text-sm text-muted">Sin TC BNA disponible</p>
                  )}
                </Link>
              </div>
            ))}
          </div>

          {sources.length === 0 ? (
            <p className="mt-6 text-center text-sm text-muted">
              Tocá el + para crear tu primera fuente de ingresos.
            </p>
          ) : null}
        </section>
      ) : (
        <section className="space-y-6 animate-in delay-2">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <GlassCard>
              <p className="text-sm text-muted">Este mes</p>
              <p className="mt-3 font-display text-3xl text-petroleum">
                {formatMoney(consolidated.monthTotal)}
              </p>
              {consolidated.monthUsd !== null ? (
                <p className="mt-1 text-sm text-muted">
                  {formatMoney(consolidated.monthUsd, "USD")}
                </p>
              ) : null}
            </GlassCard>
            <GlassCard>
              <p className="text-sm text-muted">vs. mes anterior</p>
              <p className="mt-3 font-display text-3xl text-petroleum">
                {formatPercent(consolidated.monthChange)}
              </p>
            </GlassCard>
            <GlassCard>
              <p className="text-sm text-muted">Acumulado {consolidated.year}</p>
              <p className="mt-3 font-display text-3xl text-petroleum">
                {formatMoney(consolidated.yearTotal)}
              </p>
            </GlassCard>
            <GlassCard>
              <p className="text-sm text-muted">Fuentes activas</p>
              <p className="mt-3 font-display text-3xl text-petroleum">
                {consolidated.sourceCount}
              </p>
            </GlassCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <GlassCard>
              <h2 className="mb-5 font-display text-2xl text-petroleum">
                Evolución consolidada
              </h2>
              {consolidated.sources.length === 0 ? (
                <p className="text-sm text-muted">Creá fuentes para ver el gráfico.</p>
              ) : (
                <IncomeBarChart months={consolidated.months} series={consolidated.series} />
              )}
            </GlassCard>
            <GlassCard>
              <h2 className="mb-5 font-display text-2xl text-petroleum">
                Composición del mes
              </h2>
              <IncomeCompositionChart items={consolidated.composition} />
            </GlassCard>
          </div>

          <GlassCard className="overflow-x-auto">
            <h2 className="mb-5 font-display text-2xl text-petroleum">Tabla consolidada</h2>
            {consolidated.sources.length === 0 ? (
              <p className="text-sm text-muted">Sin fuentes todavía.</p>
            ) : (
              <table className="min-w-full border-separate border-spacing-y-2 text-sm">
                <thead>
                  <tr className="text-left text-muted">
                    <th className="px-3 py-2 font-semibold">Mes</th>
                    {consolidated.sources.map((source) => (
                      <th key={source.id} className="px-3 py-2 font-semibold">
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: source.color }}
                          />
                          {source.name}
                        </span>
                      </th>
                    ))}
                    <th className="px-3 py-2 font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {consolidated.tableRows.map((row) => (
                    <tr key={row.key} className="rounded-2xl bg-white/40">
                      <td className="rounded-l-2xl px-3 py-3 capitalize">
                        {row.label} {String(row.year).slice(2)}
                      </td>
                      {row.cells.map((cell) => (
                        <td key={cell.sourceId} className="px-3 py-3">
                          <span style={{ color: cell.color }}>
                            {cell.total > 0 ? formatMoney(cell.total) : "—"}
                          </span>
                        </td>
                      ))}
                      <td className="rounded-r-2xl px-3 py-3 font-semibold text-petroleum">
                        {row.rowTotal > 0 ? formatMoney(row.rowTotal) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </GlassCard>
        </section>
      )}
    </main>
  );
}
