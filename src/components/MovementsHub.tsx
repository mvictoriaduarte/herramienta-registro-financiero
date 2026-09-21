"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { CreatePlusModal } from "@/components/CreatePlusModal";
import { IncomeBarChart, IncomeCompositionChart } from "@/components/IncomeCharts";
import { type MovementListItemData } from "@/components/MovementListItem";
import { MovementsCalendar } from "@/components/MovementsCalendar";
import { MovementsMonthList } from "@/components/MovementsMonthList";
import { SlidingTabs } from "@/components/SlidingTabs";
import { TransactionForm } from "@/components/TransactionForm";
import { GlassCard } from "@/components/ui";
import { formatPercent } from "@/lib/finance";
import { formatMoney } from "@/lib/format";

type CategoryOption = { id: string; name: string; type: string };
type AccountOption = { id: string; name: string; currency: string; active?: boolean; isDefault?: boolean };

type ConsolidatedProps = {
  monthTotal: number;
  monthUsd: number | null;
  monthChange: number | null;
  yearTotal: number;
  groupCount: number;
  year: number;
  months: { key: string; label: string }[];
  series: { id: string; name: string; color: string; values: number[] }[];
  composition: { id: string; name: string; color: string; value: number }[];
  tableRows: {
    key: string;
    label: string;
    year: number;
    cells: { groupId: string; color: string; total: number }[];
    rowTotal: number;
  }[];
  groups: { id: string; name: string; color: string }[];
};

type Tab = "lista" | "consolidado" | "calendario";

function resolveTab(value: string | null): Tab {
  if (value === "lista" || value === "calendario") {
    return value;
  }
  return "consolidado";
}

export function MovementsHub({
  categories,
  accounts,
  transactions,
  consolidated,
  bnaFx,
}: {
  categories: CategoryOption[];
  accounts: AccountOption[];
  transactions: MovementListItemData[];
  consolidated: ConsolidatedProps;
  bnaFx?: { date: string; buy: number; sell: number; source: string } | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = resolveTab(searchParams.get("vista"));
  const activeAccounts = accounts.filter((item) => item.active !== false);

  function setTab(next: Tab) {
    if (next === "consolidado") {
      router.replace("/movimientos");
      return;
    }
    router.replace(`/movimientos?vista=${next}`);
  }

  return (
    <main className="space-y-6">
      <div className="animate-in delay-1 relative flex min-h-12 items-center justify-center">
        <div className="absolute left-0 top-1/2 -translate-y-1/2">
          <h1 className="font-display text-3xl text-petroleum sm:text-4xl">Movimientos</h1>
          {bnaFx ? (
            <p className="mt-1 text-sm text-muted">
              TC BNA venta {bnaFx.sell.toLocaleString("es-AR", { minimumFractionDigits: 2 })} ·{" "}
              {bnaFx.date.split("-").reverse().join("/")}
            </p>
          ) : null}
        </div>
        <SlidingTabs
          tabs={
            [
              { id: "consolidado", label: "Vista consolidada" },
              { id: "lista", label: "Lista" },
              { id: "calendario", label: "Calendario" },
            ] as const
          }
          value={tab}
          onChange={setTab}
        />
        <div className="absolute right-0 top-1/2 -translate-y-1/2">
          <CreatePlusModal title="Nuevo movimiento" ariaLabel="Crear movimiento">
            <TransactionForm
              categories={categories}
              accounts={activeAccounts}
            />
          </CreatePlusModal>
        </div>
      </div>

      {tab === "lista" ? (
        <GlassCard className="animate-in delay-2">
          {transactions.length === 0 ? (
            <p className="text-sm text-muted">
              Cuando cargues un ingreso o un gasto, aparece acá.
            </p>
          ) : (
            <MovementsMonthList
              transactions={transactions}
              categories={categories}
              accounts={accounts}
              bnaSell={bnaFx?.sell ?? null}
            />
          )}
        </GlassCard>
      ) : tab === "calendario" ? (
        <div className="animate-in delay-2">
          <MovementsCalendar
            transactions={transactions}
            categories={categories}
            accounts={accounts}
            bnaSell={bnaFx?.sell ?? null}
          />
        </div>
      ) : (
        <section className="space-y-6 animate-in delay-2">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <GlassCard>
              <p className="text-sm text-muted">Gastos este mes</p>
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
              <p className="text-sm text-muted">Grupos con gasto</p>
              <p className="mt-3 font-display text-3xl text-petroleum">
                {consolidated.groupCount}
              </p>
            </GlassCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <GlassCard>
              <h2 className="mb-5 font-display text-2xl text-petroleum">
                Evolución por grupo
              </h2>
              {consolidated.groups.length === 0 ? (
                <p className="text-sm text-muted">Todavía no hay gastos para graficar.</p>
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
            <h2 className="mb-5 font-display text-2xl text-petroleum">Tabla por grupo</h2>
            {consolidated.groups.length === 0 ? (
              <p className="text-sm text-muted">Sin gastos todavía.</p>
            ) : (
              <table className="min-w-full border-separate border-spacing-y-2 text-sm">
                <thead>
                  <tr className="text-left text-muted">
                    <th className="px-3 py-2 font-semibold">Mes</th>
                    {consolidated.groups.map((group) => (
                      <th key={group.id} className="px-3 py-2 font-semibold">
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: group.color }}
                          />
                          {group.name}
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
                        <td key={cell.groupId} className="px-3 py-3">
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
