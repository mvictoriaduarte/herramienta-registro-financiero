"use client";

import { deleteAccountAction } from "@/actions/accounts";
import { IconPencil } from "@/components/ActionIcons";
import { EditAccountForm } from "@/components/AccountForm";
import { CreatePlusModal } from "@/components/CreatePlusModal";
import { DeleteButton } from "@/components/DeleteButton";
import { parseAccountPurpose } from "@/lib/finance";
import { ACCOUNT_PURPOSE_LABELS } from "@/lib/types";

type AccountRow = {
  id: string;
  name: string;
  currency: string;
  purpose: string;
  isDefault: boolean;
  transactions: number;
};

export function AccountsList({ accounts }: { accounts: AccountRow[] }) {
  return (
    <ul className="space-y-3">
      {accounts.map((account) => {
        const purpose = parseAccountPurpose(account.purpose);
        return (
          <li
            key={account.id}
            className="flex flex-col gap-3 rounded-2xl bg-white/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-medium">{account.name}</p>
              <p className="text-sm text-muted">
                {ACCOUNT_PURPOSE_LABELS[purpose]} · {account.currency} ·{" "}
                {account.transactions} movimientos
              </p>
            </div>
            <div className="flex items-center gap-1">
              <CreatePlusModal
                title="Editar cuenta"
                ariaLabel="Editar cuenta"
                trigger={<IconPencil />}
              >
                <EditAccountForm
                  account={{
                    id: account.id,
                    name: account.name,
                    currency: account.currency,
                    purpose,
                    isDefault: account.isDefault,
                  }}
                />
              </CreatePlusModal>
              <DeleteButton
                action={deleteAccountAction}
                id={account.id}
                icon
                label="Eliminar cuenta"
                confirmTitle="Eliminar cuenta"
                confirmMessage={`¿Estás seguro/a de querer eliminar la cuenta “${account.name}”? Los movimientos asociados quedarán sin cuenta.`}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
