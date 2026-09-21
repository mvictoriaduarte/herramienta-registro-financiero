"use client";

import { deleteIncomePeriodAction } from "@/actions/income";
import { IconPencil } from "@/components/ActionIcons";
import { CreatePlusModal } from "@/components/CreatePlusModal";
import { DeleteButton } from "@/components/DeleteButton";
import { IncomePeriodForm } from "@/components/IncomeForms";
import { formatPercent } from "@/lib/finance";
import { formatDate, formatMoney } from "@/lib/format";

type PeriodRow = {
  id: string;
  date: string;
  note: string;
  year: number;
  month: number;
  units: number | null;
  unitValue: number | null;
  fixedAmount: number | null;
  adjustments: { name: string; amount: number }[];
  total: number;
  detail: string;
  usd: number | null;
  change: number | null;
};

export function IncomePeriodsTable({
  sourceId,
  billingMode,
  accentColor,
  rows,
}: {
  sourceId: string;
  billingMode: string;
  accentColor: string;
  rows: PeriodRow[];
}) {
  return (
    <table className="min-w-full border-separate border-spacing-y-2 text-sm">
      <thead>
        <tr className="text-left text-muted">
          <th className="px-3 py-2">Fecha</th>
          <th className="px-3 py-2">Descripción</th>
          <th className="px-3 py-2">Detalle</th>
          <th className="px-3 py-2">Total ARS</th>
          <th className="px-3 py-2">USD</th>
          <th className="px-3 py-2">Δ %</th>
          <th className="px-3 py-2" />
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="bg-white/40">
            <td className="rounded-l-2xl px-3 py-3">{formatDate(row.date)}</td>
            <td className="px-3 py-3 text-muted">{row.note || "—"}</td>
            <td className="px-3 py-3 text-muted">{row.detail}</td>
            <td className="px-3 py-3 font-semibold" style={{ color: accentColor }}>
              {formatMoney(row.total)}
            </td>
            <td className="px-3 py-3">
              {row.usd !== null ? formatMoney(row.usd, "USD") : "—"}
            </td>
            <td className="px-3 py-3">{formatPercent(row.change)}</td>
            <td className="rounded-r-2xl px-3 py-3">
              <div className="flex items-center justify-end gap-1">
                <CreatePlusModal
                  title="Editar ingreso"
                  ariaLabel="Editar ingreso"
                  size="lg"
                  trigger={<IconPencil />}
                >
                  <IncomePeriodForm
                    sourceId={sourceId}
                    billingMode={billingMode}
                    accentColor={accentColor}
                    defaults={{
                      id: row.id,
                      date: row.date,
                      note: row.note,
                      units: row.units,
                      unitValue: row.unitValue,
                      fixedAmount: row.fixedAmount,
                      adjustments: row.adjustments,
                    }}
                  />
                </CreatePlusModal>
                <DeleteButton
                  action={deleteIncomePeriodAction}
                  id={row.id}
                  icon
                  label="Eliminar ingreso"
                  confirmTitle="Eliminar ingreso"
                  confirmMessage={`¿Estás seguro/a de querer eliminar el ingreso del ${formatDate(row.date)}?`}
                />
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
