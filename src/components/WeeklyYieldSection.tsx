import { deleteWeeklySnapshotAction } from "@/actions/weekly-snapshots";
import { IconPencil } from "@/components/ActionIcons";
import { CreatePlusModal } from "@/components/CreatePlusModal";
import { DeleteButton } from "@/components/DeleteButton";
import { GlassCard } from "@/components/ui";
import {
  EditWeeklySnapshotForm,
  WeeklySnapshotForm,
} from "@/components/WeeklySnapshotForm";
import { formatPercent } from "@/lib/finance";
import { formatDate, formatMoney } from "@/lib/format";

type AccountOption = {
  id: string;
  name: string;
  currency: string;
};

type BnaFx = {
  date: string;
  buy: number;
  sell: number;
  source: string;
} | null;

type Snapshot = {
  id: string;
  accountId: string;
  weekDate: string;
  currency: "ARS" | "USD";
  amountArs: number;
  amountUsd: number;
};

export type WeeklyYieldRow = {
  weekDate: string;
  snapshot: Snapshot | null;
  deposits: number;
  withdrawals: number;
  previous: number | null;
  current: number | null;
  expected: number | null;
  net: number | null;
  percent: number | null;
};

function money(amount: number, currency: "ARS" | "USD") {
  return formatMoney(amount, currency);
}

function signedMoney(amount: number | null, currency: "ARS" | "USD") {
  if (amount == null) {
    return "—";
  }
  const sign = amount > 0 ? "+" : "";
  return `${sign}${money(amount, currency)}`;
}

export function WeeklyYieldSection({
  account,
  accounts,
  rows,
  mondays,
  currency,
  bnaFx,
}: {
  account: AccountOption;
  accounts: AccountOption[];
  rows: WeeklyYieldRow[];
  mondays: string[];
  currency: "ARS" | "USD";
  bnaFx: BnaFx;
}) {
  const latest = [...rows].reverse().find((row) => row.snapshot);
  const defaultWeek =
    [...rows].reverse().find((row) => !row.snapshot)?.weekDate ??
    mondays[mondays.length - 1];

  return (
    <GlassCard className="animate-in delay-4">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl text-petroleum">Rendimiento semanal</h2>
          <p className="mt-1 text-sm text-muted">
            Contra el lunes anterior, más ingresos y menos retiros de la cuenta.
          </p>
        </div>
        <CreatePlusModal title="Cargar saldo del lunes" ariaLabel="Cargar saldo del lunes">
          <WeeklySnapshotForm
            accounts={accounts}
            bnaFx={bnaFx}
            mondays={mondays}
            defaults={{
              accountId: account.id,
              weekDate: defaultWeek,
              currency,
            }}
          />
        </CreatePlusModal>
      </div>

      {latest?.net != null ? (
        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-white/40 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.14em] text-muted">Último neto</p>
            <p className="mt-1 font-display text-2xl text-petroleum">
              {signedMoney(latest.net, currency)}
            </p>
          </div>
          <div className="rounded-2xl bg-white/40 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.14em] text-muted">Último %</p>
            <p className="mt-1 font-display text-2xl text-petroleum">
              {formatPercent(latest.percent, 2)}
            </p>
          </div>
          <div className="rounded-2xl bg-white/40 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.14em] text-muted">
              Ingresos / retiros
            </p>
            <p className="mt-1 text-sm font-medium text-petroleum">
              {money(latest.deposits, currency)} / {money(latest.withdrawals, currency)}
            </p>
          </div>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <p className="text-sm text-muted">No hay lunes para mostrar en este mes.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => {
            const label = formatDate(new Date(`${row.weekDate}T12:00:00`));
            return (
              <li
                key={row.weekDate}
                className="flex flex-col gap-3 rounded-2xl bg-white/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">Lunes {label}</p>
                  <p className="text-sm text-muted">
                    {row.current == null
                      ? "Sin cargar"
                      : money(row.current, currency)}
                    {row.snapshot
                      ? ` · Ingresos ${money(row.deposits, currency)} · Retiros ${money(row.withdrawals, currency)}`
                      : null}
                  </p>
                  {row.net != null ? (
                    <p className="mt-1 text-sm font-medium text-petroleum">
                      Rendimiento {signedMoney(row.net, currency)} ·{" "}
                      {formatPercent(row.percent, 2)}
                    </p>
                  ) : row.snapshot ? (
                    <p className="mt-1 text-sm text-muted">
                      Cargá el lunes anterior para ver el rendimiento.
                    </p>
                  ) : null}
                </div>
                {row.snapshot ? (
                  <div className="flex items-center gap-1">
                    <CreatePlusModal
                      title="Editar saldo del lunes"
                      ariaLabel="Editar saldo del lunes"
                      trigger={<IconPencil />}
                    >
                      <EditWeeklySnapshotForm
                        accounts={accounts}
                        bnaFx={bnaFx}
                        mondays={mondays}
                        snapshot={row.snapshot}
                      />
                    </CreatePlusModal>
                    <DeleteButton
                      action={deleteWeeklySnapshotAction}
                      id={row.snapshot.id}
                      icon
                      label="Eliminar saldo"
                      confirmTitle="Eliminar saldo del lunes"
                      confirmMessage={`¿Estás seguro/a de querer eliminar el saldo del lunes ${label} de “${account.name}”?`}
                    />
                  </div>
                ) : (
                  <CreatePlusModal
                    size="sm"
                    title="Cargar saldo del lunes"
                    ariaLabel={`Cargar saldo del ${label}`}
                  >
                    <WeeklySnapshotForm
                      accounts={accounts}
                      bnaFx={bnaFx}
                      mondays={mondays}
                      defaults={{
                        accountId: account.id,
                        weekDate: row.weekDate,
                        currency,
                      }}
                    />
                  </CreatePlusModal>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </GlassCard>
  );
}
