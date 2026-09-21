import { deleteAccountBalanceAction } from "@/actions/balances";
import { IconPencil } from "@/components/ActionIcons";
import { BalanceForm, EditBalanceForm } from "@/components/BalanceForm";
import { CreatePlusModal } from "@/components/CreatePlusModal";
import { DeleteButton } from "@/components/DeleteButton";
import { holdingCurrency, monthLabel } from "@/lib/finance";
import { formatMoney } from "@/lib/format";

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

type BalanceRecord = {
  id: string;
  accountId: string;
  year: number;
  month: number;
  kind: string;
  currency: string;
  amountArs: number;
  amountUsd: number;
};

function amountLabel(
  currency: "ARS" | "USD",
  amountArs: number,
  amountUsd: number,
) {
  return currency === "USD"
    ? `${formatMoney(amountUsd, "USD")} · ${formatMoney(amountArs)}`
    : `${formatMoney(amountArs)} · ${formatMoney(amountUsd, "USD")}`;
}

export function HoldingKindRow({
  kind,
  record,
  account,
  accounts,
  year,
  month,
  bnaFx,
}: {
  kind: "start" | "end";
  record: BalanceRecord | null;
  account: AccountOption;
  accounts: AccountOption[];
  year: number;
  month: number;
  bnaFx: BnaFx;
}) {
  const kindLabel = kind === "start" ? "Inicio" : "Fin";
  const currency = holdingCurrency(record?.currency, account.currency);

  return (
    <li className="flex flex-col gap-3 rounded-2xl bg-white/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-medium">{kindLabel}</p>
        <p className="text-sm text-muted">
          {record
            ? amountLabel(currency, record.amountArs, record.amountUsd)
            : "Sin cargar"}
        </p>
      </div>
      {record ? (
        <div className="flex items-center gap-1">
          <CreatePlusModal
            title={`Editar ${kindLabel.toLowerCase()}`}
            ariaLabel={`Editar ${kindLabel.toLowerCase()}`}
            trigger={<IconPencil />}
          >
            <EditBalanceForm
              accounts={accounts}
              bnaFx={bnaFx}
              balance={{
                id: record.id,
                accountId: record.accountId,
                year: record.year,
                month: record.month,
                kind,
                currency,
                amountArs: record.amountArs,
                amountUsd: record.amountUsd,
              }}
            />
          </CreatePlusModal>
          <DeleteButton
            action={deleteAccountBalanceAction}
            id={record.id}
            icon
            label="Eliminar tenencia"
            confirmTitle="Eliminar tenencia"
            confirmMessage={`¿Estás seguro/a de querer eliminar el ${kindLabel.toLowerCase()} de “${account.name}” (${monthLabel(month)} ${year})?`}
          />
        </div>
      ) : (
        <CreatePlusModal
          size="sm"
          title={`Cargar ${kindLabel.toLowerCase()}`}
          ariaLabel={`Cargar ${kindLabel.toLowerCase()}`}
        >
          <BalanceForm
            accounts={accounts}
            bnaFx={bnaFx}
            defaults={{
              accountId: account.id,
              year,
              month,
              kind,
              currency: account.currency === "USD" ? "USD" : "ARS",
            }}
          />
        </CreatePlusModal>
      )}
    </li>
  );
}
