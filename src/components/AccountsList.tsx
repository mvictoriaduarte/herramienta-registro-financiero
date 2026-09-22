"use client";

import { deleteAccountAction } from "@/actions/accounts";
import { IconPencil } from "@/components/ActionIcons";
import { EditAccountForm } from "@/components/AccountForm";
import { CreatePlusModal } from "@/components/CreatePlusModal";
import { DeleteButton } from "@/components/DeleteButton";
import { parseAccountPurpose, parseBankRole, resolvedBank } from "@/lib/finance";
import { ACCOUNT_BANK_ROLE_LABELS, ACCOUNT_PURPOSE_LABELS } from "@/lib/types";

type AccountRow = {
  id: string;
  name: string;
  currency: string;
  purpose: string;
  tracksYield: boolean;
  bankName: string;
  bankRole: string;
  isDefault: boolean;
  transactions: number;
};

export function AccountsList({
  accounts,
  knownBanks = [],
}: {
  accounts: AccountRow[];
  knownBanks?: string[];
}) {
  return (
    <ul className="space-y-3">
      {accounts.map((account) => {
        const purpose = parseAccountPurpose(account.purpose);
        const bank = resolvedBank(account);
        const bankRole = parseBankRole(bank.bankRole);
        return (
          <li
            key={account.id}
            className="flex flex-col gap-3 rounded-2xl bg-white/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-medium">{account.name}</p>
              <p className="text-sm text-muted">
                {ACCOUNT_PURPOSE_LABELS[purpose]}
                {bank.bankName && bankRole !== "none"
                  ? ` · ${bank.bankName} · ${ACCOUNT_BANK_ROLE_LABELS[bankRole]}`
                  : ""}
                {account.tracksYield ? " · Rendimiento semanal" : ""} · {account.currency} ·{" "}
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
                  knownBanks={knownBanks}
                  account={{
                    id: account.id,
                    name: account.name,
                    currency: account.currency,
                    purpose,
                    tracksYield: account.tracksYield,
                    bankName: bank.bankName,
                    bankRole,
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
