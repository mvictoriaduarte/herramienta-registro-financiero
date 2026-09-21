"use client";

import { IconPencil, IconRefund } from "@/components/ActionIcons";
import { CreatePlusModal } from "@/components/CreatePlusModal";
import { DeleteButton } from "@/components/DeleteButton";
import { EditTransactionForm } from "@/components/TransactionForm";
import { TransactionRefundForm } from "@/components/TransactionRefundForm";
import {
  deleteTransactionAction,
  deleteTransactionRefundAction,
} from "@/actions/transactions";
import { categoryTypeLabel, transactionDisplayParts } from "@/lib/finance";
import { formatDate, formatMoney } from "@/lib/format";

export type MovementListItemData = {
  id: string;
  incomeAmount: number;
  expenseAmount: number;
  amount: number;
  date: string;
  note: string;
  currency: string;
  fxRate: number | null;
  categoryId: string;
  accountId: string | null;
  category: { id: string; name: string; type: string; group: string };
  account: { name: string } | null;
  refunds: {
    id: string;
    amount: number;
    note: string;
    date: string | null;
  }[];
};

type CategoryOption = { id: string; name: string; type: string };
type AccountOption = { id: string; name: string; currency: string; active?: boolean; isDefault?: boolean };

export function MovementListItem({
  item,
  categories,
  accounts,
}: {
  item: MovementListItemData;
  categories: CategoryOption[];
  accounts: AccountOption[];
  bnaSell?: number | null;
}) {
  const { isIncome, amount, gross, refunded } = transactionDisplayParts(item);
  const remaining = Math.round((gross - refunded) * 100) / 100;
  const canRefund = !isIncome && item.expenseAmount > 0 && remaining > 0;

  return (
    <li className="space-y-3 rounded-2xl bg-white/40 px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium">
            {item.note.trim() || item.category.name}
          </p>
          <p className="text-sm text-muted">
            {formatDate(item.date)} · {item.account?.name ?? "Sin cuenta"} ·{" "}
            {item.category.name}
            {item.category.group ? ` · ${item.category.group}` : ""} ·{" "}
            {categoryTypeLabel(item.category.type)}
          </p>
          {!isIncome && refunded > 0 ? (
            <p className="mt-1 text-sm text-petroleum-soft">
              Bruto {formatMoney(gross, item.currency as "ARS" | "USD")} · Devuelto{" "}
              {formatMoney(refunded, item.currency as "ARS" | "USD")}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5">
          <p
            className={`mr-2 font-semibold ${
              isIncome ? "text-emerald-700" : "text-rose-700"
            }`}
          >
            {isIncome ? "+" : "-"}
            {formatMoney(amount, item.currency as "ARS" | "USD")}
          </p>
          {canRefund ? (
            <CreatePlusModal
              title="Devolución"
              ariaLabel="Agregar devolución"
              trigger={<IconRefund />}
            >
              <TransactionRefundForm
                transactionId={item.id}
                remaining={remaining}
                currency={item.currency}
              />
            </CreatePlusModal>
          ) : null}
          <CreatePlusModal
            title="Editar movimiento"
            ariaLabel="Editar movimiento"
            trigger={<IconPencil />}
          >
            <EditTransactionForm
              transaction={{
                id: item.id,
                incomeAmount: item.incomeAmount,
                expenseAmount: item.expenseAmount,
                date: item.date,
                note: item.note,
                currency: item.currency,
                fxRate: item.fxRate,
                categoryId: item.categoryId,
                accountId: item.accountId,
              }}
              categories={categories}
              accounts={accounts}
            />
          </CreatePlusModal>
          <DeleteButton action={deleteTransactionAction} id={item.id} icon />
        </div>
      </div>

      {item.refunds.length > 0 ? (
        <ul className="space-y-2 border-t border-white/50 pt-3">
          {item.refunds.map((refund) => (
            <li key={refund.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted">
                Devolución
                {refund.note ? ` · ${refund.note}` : ""}
                {refund.date ? ` · ${formatDate(refund.date)}` : ""}
              </span>
              <span className="flex items-center gap-3">
                <span className="font-medium text-petroleum">
                  +{formatMoney(refund.amount, item.currency as "ARS" | "USD")}
                </span>
                <DeleteButton
                  action={deleteTransactionRefundAction}
                  id={refund.id}
                  label="Borrar devolución"
                  icon
                />
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}
