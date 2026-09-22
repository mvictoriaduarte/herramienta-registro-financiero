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
import { categoryTypeLabel, isTransferMovement, transactionDisplayParts } from "@/lib/finance";
import { formatDate, formatMoney } from "@/lib/format";
import { TRANSFER_KIND_LABELS } from "@/lib/types";

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
  transferKind?: string;
  transferGroupId?: string;
  operatingAccountId?: string;
  instrumentAccountId?: string;
  transferPartner?: {
    id: string;
    accountId: string | null;
    accountName: string;
    incomeAmount: number;
    expenseAmount: number;
  } | null;
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
type AccountOption = {
  id: string;
  name: string;
  currency: string;
  active?: boolean;
  isDefault?: boolean;
  bankName?: string;
  bankRole?: string;
};

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
  const isTransfer = isTransferMovement(item.transferKind);
  const canRefund = !isTransfer && !isIncome && item.expenseAmount > 0 && remaining > 0;
  const transferKind =
    item.transferKind === "redemption" ? "redemption" : "investment";
  const fromName =
    item.expenseAmount > 0
      ? item.account?.name
      : item.transferPartner?.accountName;
  const toName =
    item.incomeAmount > 0
      ? item.account?.name
      : item.transferPartner?.accountName;

  return (
    <li className="space-y-3 rounded-2xl bg-white/40 px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium">
            {isTransfer
              ? item.note.trim() || TRANSFER_KIND_LABELS[transferKind]
              : item.note.trim() || item.category.name}
          </p>
          <p className="text-sm text-muted">
            {formatDate(item.date)} ·{" "}
            {isTransfer
              ? `${fromName ?? "Cuenta"} → ${toName ?? "Cuenta"} · ${TRANSFER_KIND_LABELS[transferKind]}`
              : `${item.account?.name ?? "Sin cuenta"} · ${item.category.name}${
                  item.category.group ? ` · ${item.category.group}` : ""
                } · ${categoryTypeLabel(item.category.type)}`}
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
              isTransfer
                ? "text-petroleum"
                : isIncome
                  ? "text-emerald-700"
                  : "text-rose-700"
            }`}
          >
            {isTransfer ? "" : isIncome ? "+" : "-"}
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
                transferKind: item.transferKind,
                transferGroupId: item.transferGroupId,
                operatingAccountId: item.operatingAccountId,
                instrumentAccountId: item.instrumentAccountId,
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
          {item.refunds.map((refund) => {
            const maxAllowed = Math.round((remaining + refund.amount) * 100) / 100;
            return (
              <li key={refund.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted">
                  Devolución
                  {refund.note ? ` · ${refund.note}` : ""}
                  {refund.date ? ` · ${formatDate(refund.date)}` : ""}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="mr-1 font-medium text-petroleum">
                    +{formatMoney(refund.amount, item.currency as "ARS" | "USD")}
                  </span>
                  <CreatePlusModal
                    title="Editar devolución"
                    ariaLabel="Editar devolución"
                    trigger={<IconPencil />}
                  >
                    <TransactionRefundForm
                      transactionId={item.id}
                      remaining={maxAllowed}
                      currency={item.currency}
                      defaults={{
                        id: refund.id,
                        amount: refund.amount,
                        note: refund.note,
                        date: refund.date,
                      }}
                    />
                  </CreatePlusModal>
                  <DeleteButton
                    action={deleteTransactionRefundAction}
                    id={refund.id}
                    label="Borrar devolución"
                    icon
                  />
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </li>
  );
}
