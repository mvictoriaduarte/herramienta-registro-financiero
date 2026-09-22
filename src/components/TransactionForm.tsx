"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createTransactionAction,
  updateTransactionAction,
} from "@/actions/transactions";
import { useCreatePlusClose } from "@/components/CreatePlusModal";
import { Button, Field, FormMessage, Input, Select } from "@/components/ui";
import {
  bankTransferGroups,
  isExpenseLike,
  isIncomeCategory,
  isTransferMovement,
} from "@/lib/finance";
import { toDateInputValue } from "@/lib/format";
import { TRANSFER_KIND_LABELS } from "@/lib/types";

type CategoryOption = {
  id: string;
  name: string;
  type: string;
};

type AccountOption = {
  id: string;
  name: string;
  currency: string;
  isDefault?: boolean;
  bankName?: string;
  bankRole?: string;
};

type AmountDirection = "income" | "expense";
type EntryKind = "cash" | "transfer";
type TransferDirection = "investment" | "redemption";

type TransactionValues = {
  id: string;
  incomeAmount: number;
  expenseAmount: number;
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
};

function EntryKindPicker({
  value,
  onChange,
  allowTransfer,
}: {
  value: EntryKind;
  onChange: (next: EntryKind) => void;
  allowTransfer: boolean;
}) {
  if (!allowTransfer) {
    return <input type="hidden" name="entryKind" value="cash" />;
  }

  return (
    <div className="space-y-2">
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
        Tipo
      </span>
      <div
        className="grid grid-cols-2 gap-1 rounded-2xl border border-white/70 bg-white/50 p-1"
        role="group"
        aria-label="Tipo de movimiento"
      >
        <button
          type="button"
          aria-pressed={value === "cash"}
          onClick={() => onChange("cash")}
          className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
            value === "cash"
              ? "bg-petroleum text-white shadow-sm"
              : "text-muted hover:bg-white/70 hover:text-petroleum"
          }`}
        >
          Gasto / ingreso
        </button>
        <button
          type="button"
          aria-pressed={value === "transfer"}
          onClick={() => onChange("transfer")}
          className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
            value === "transfer"
              ? "bg-petroleum text-white shadow-sm"
              : "text-muted hover:bg-white/70 hover:text-petroleum"
          }`}
        >
          Inversión / rescate
        </button>
      </div>
      <input type="hidden" name="entryKind" value={value} />
    </div>
  );
}

function AmountField({
  direction,
  onDirectionChange,
  defaultAmount = "",
}: {
  direction: AmountDirection;
  onDirectionChange: (next: AmountDirection) => void;
  defaultAmount?: string;
}) {
  return (
    <div className="space-y-2">
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
        Monto
      </span>
      <div className="flex gap-2">
        <div
          className="inline-flex shrink-0 overflow-hidden rounded-2xl border border-white/70 bg-white/50 p-1"
          role="group"
          aria-label="Tipo de monto"
        >
          <button
            type="button"
            aria-label="Ingreso"
            aria-pressed={direction === "income"}
            onClick={() => onDirectionChange("income")}
            className={`inline-flex h-10 w-10 items-center justify-center rounded-xl text-lg font-semibold transition ${
              direction === "income"
                ? "bg-petroleum text-white shadow-sm"
                : "text-muted hover:bg-white/70 hover:text-petroleum"
            }`}
          >
            +
          </button>
          <button
            type="button"
            aria-label="Gasto"
            aria-pressed={direction === "expense"}
            onClick={() => onDirectionChange("expense")}
            className={`inline-flex h-10 w-10 items-center justify-center rounded-xl text-lg font-semibold transition ${
              direction === "expense"
                ? "bg-petroleum text-white shadow-sm"
                : "text-muted hover:bg-white/70 hover:text-petroleum"
            }`}
          >
            −
          </button>
        </div>
        <input type="hidden" name="direction" value={direction} />
        <Input
          name="amount"
          inputMode="decimal"
          placeholder="0"
          defaultValue={defaultAmount}
          required
          className="flex-1"
          aria-label="Monto"
        />
      </div>
    </div>
  );
}

function TransactionFields({
  categories,
  accounts,
  defaults,
}: {
  categories: CategoryOption[];
  accounts: AccountOption[];
  defaults?: Partial<{
    direction: AmountDirection;
    amount: string;
    accountId: string;
    categoryId: string;
    date: string;
    currency: string;
    note: string;
  }>;
}) {
  const [direction, setDirection] = useState<AmountDirection>(
    defaults?.direction ?? "expense",
  );
  const [categoryId, setCategoryId] = useState(defaults?.categoryId ?? "");

  const defaultAccountId =
    defaults?.accountId ??
    accounts.find((account) => account.isDefault)?.id ??
    accounts[0]?.id;

  const filteredCategories = useMemo(() => {
    return categories.filter((category) =>
      direction === "income"
        ? isIncomeCategory(category.type)
        : isExpenseLike(category.type),
    );
  }, [categories, direction]);

  useEffect(() => {
    if (filteredCategories.length === 0) {
      setCategoryId("");
      return;
    }
    if (!filteredCategories.some((category) => category.id === categoryId)) {
      setCategoryId(filteredCategories[0].id);
    }
  }, [filteredCategories, categoryId]);

  return (
    <>
      <AmountField
        direction={direction}
        onDirectionChange={setDirection}
        defaultAmount={defaults?.amount ?? ""}
      />
      <Field label="Origen / destino">
        <Select name="accountId" required defaultValue={defaultAccountId}>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name} ({account.currency})
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Concepto">
        {filteredCategories.length === 0 ? (
          <p className="text-sm text-muted">
            No hay conceptos para {direction === "income" ? "ingresos" : "gastos"}.
          </p>
        ) : (
          <Select
            name="categoryId"
            required
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            {filteredCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Fecha">
        <Input
          name="date"
          type="date"
          defaultValue={defaults?.date ?? toDateInputValue()}
          required
        />
      </Field>
      <Field label="Moneda">
        <Select name="currency" defaultValue={defaults?.currency ?? "ARS"}>
          <option value="ARS">ARS</option>
          <option value="USD">USD</option>
        </Select>
      </Field>
      <Field label="Descripción">
        <Input
          name="note"
          placeholder="Opcional"
          defaultValue={defaults?.note ?? ""}
        />
      </Field>
    </>
  );
}

function TransferFields({
  accounts,
  defaults,
}: {
  accounts: AccountOption[];
  defaults?: Partial<{
    transferKind: TransferDirection;
    amount: string;
    operatingAccountId: string;
    instrumentAccountId: string;
    date: string;
    note: string;
  }>;
}) {
  const groups = useMemo(() => bankTransferGroups(accounts), [accounts]);
  const [bankName, setBankName] = useState(
    () =>
      groups.find(
        (group) =>
          group.operating.some((item) => item.id === defaults?.operatingAccountId) ||
          group.instruments.some((item) => item.id === defaults?.instrumentAccountId),
      )?.bankName ??
      groups[0]?.bankName ??
      "",
  );
  const [transferKind, setTransferKind] = useState<TransferDirection>(
    defaults?.transferKind ?? "investment",
  );

  const selectedRaw = groups.find((group) => group.bankName === bankName) ?? groups[0];
  const selected = selectedRaw
    ? {
        ...selectedRaw,
        operating: selectedRaw.operating.filter(
          (account) =>
            account.currency === "ARS" ||
            selectedRaw.instruments.some((item) => item.currency === account.currency),
        ),
      }
    : undefined;
  const operatingId =
    defaults?.operatingAccountId &&
    selected?.operating.some((item) => item.id === defaults.operatingAccountId)
      ? defaults.operatingAccountId
      : selected?.operating[0]?.id;
  const instrumentId =
    defaults?.instrumentAccountId &&
    selected?.instruments.some((item) => item.id === defaults.instrumentAccountId)
      ? defaults.instrumentAccountId
      : selected?.instruments[0]?.id;

  if (!selected) {
    return (
      <p className="text-sm text-muted">
        Para inversiones y rescates, configurá en Cuentas un banco con caja operativa e
        instrumento.
      </p>
    );
  }

  return (
    <>
      <div className="space-y-2">
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
          Movimiento
        </span>
        <div
          className="grid grid-cols-2 gap-1 rounded-2xl border border-white/70 bg-white/50 p-1"
          role="group"
          aria-label="Inversión o rescate"
        >
          {(["investment", "redemption"] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              aria-pressed={transferKind === kind}
              onClick={() => setTransferKind(kind)}
              className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                transferKind === kind
                  ? "bg-petroleum text-white shadow-sm"
                  : "text-muted hover:bg-white/70 hover:text-petroleum"
              }`}
            >
              {TRANSFER_KIND_LABELS[kind]}
            </button>
          ))}
        </div>
        <input type="hidden" name="transferKind" value={transferKind} />
      </div>
      {groups.length > 1 ? (
        <Field label="Banco">
          <Select
            value={selected.bankName}
            onChange={(event) => setBankName(event.target.value)}
          >
            {groups.map((group) => (
              <option key={group.bankName} value={group.bankName}>
                {group.bankName}
              </option>
            ))}
          </Select>
        </Field>
      ) : (
        <input type="hidden" name="bankName" value={selected.bankName} />
      )}
      {selected.operating.length > 1 ? (
        <Field label="Caja / cuenta operativa">
          <Select key={selected.bankName} name="operatingAccountId" required defaultValue={operatingId}>
            {selected.operating.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : (
        <input
          type="hidden"
          name="operatingAccountId"
          defaultValue={operatingId ?? ""}
          key={`op-${operatingId ?? "none"}`}
        />
      )}
      {selected.instruments.length > 1 ? (
        <Field label="Instrumento">
          <Select key={`${selected.bankName}-inst`} name="instrumentAccountId" required defaultValue={instrumentId}>
            {selected.instruments.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} ({account.currency})
              </option>
            ))}
          </Select>
        </Field>
      ) : (
        <input
          type="hidden"
          name="instrumentAccountId"
          defaultValue={instrumentId ?? ""}
          key={`inst-${instrumentId ?? "none"}`}
        />
      )}
      <p className="text-sm text-muted">
        {transferKind === "investment"
          ? `Se debita ${selected.operating.find((item) => item.id === operatingId)?.name ?? "la caja"} y se acredita ${selected.instruments.find((item) => item.id === instrumentId)?.name ?? "el instrumento"} en ARS.`
          : `Se debita ${selected.instruments.find((item) => item.id === instrumentId)?.name ?? "el instrumento"} y se acredita ${selected.operating.find((item) => item.id === operatingId)?.name ?? "la caja"} en ARS.`}
      </p>
      <Field label="Monto ARS">
        <Input
          name="amount"
          inputMode="decimal"
          placeholder="0"
          defaultValue={defaults?.amount ?? ""}
          required
        />
      </Field>
      <Field label="Fecha">
        <Input
          name="date"
          type="date"
          defaultValue={defaults?.date ?? toDateInputValue()}
          required
        />
      </Field>
      <Field label="Descripción">
        <Input
          name="note"
          placeholder="Opcional"
          defaultValue={defaults?.note ?? ""}
        />
      </Field>
    </>
  );
}

function MovementFormBody({
  categories,
  accounts,
  defaults,
  lockEntryKind,
}: {
  categories: CategoryOption[];
  accounts: AccountOption[];
  lockEntryKind?: EntryKind;
  defaults?: Partial<{
    entryKind: EntryKind;
    direction: AmountDirection;
    amount: string;
    accountId: string;
    categoryId: string;
    date: string;
    currency: string;
    note: string;
    transferKind: TransferDirection;
    operatingAccountId: string;
    instrumentAccountId: string;
  }>;
}) {
  const groups = useMemo(() => bankTransferGroups(accounts), [accounts]);
  const allowTransfer = groups.length > 0;
  const [entryKind, setEntryKind] = useState<EntryKind>(
    lockEntryKind ??
      defaults?.entryKind ??
      (allowTransfer ? "cash" : "cash"),
  );
  const kind = lockEntryKind ?? entryKind;

  return (
    <>
      <EntryKindPicker
        value={kind}
        onChange={setEntryKind}
        allowTransfer={allowTransfer && !lockEntryKind}
      />
      {kind === "transfer" && allowTransfer ? (
        <TransferFields accounts={accounts} defaults={defaults} />
      ) : (
        <TransactionFields
          categories={categories}
          accounts={accounts}
          defaults={defaults}
        />
      )}
    </>
  );
}

export function TransactionForm({
  categories,
  accounts,
}: {
  categories: CategoryOption[];
  accounts: AccountOption[];
}) {
  const router = useRouter();
  const close = useCreatePlusClose();
  const [state, action, pending] = useActionState(createTransactionAction, null);

  useEffect(() => {
    if (state?.success) {
      close?.();
      router.refresh();
    }
  }, [state, close, router]);

  if (categories.length === 0 || accounts.length === 0) {
    return (
      <p className="text-sm text-muted">
        Primero creá al menos un concepto y una cuenta (origen/destino).
      </p>
    );
  }

  return (
    <form action={action} className="grid gap-4">
      <MovementFormBody categories={categories} accounts={accounts} />
      <FormMessage state={state} />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Guardando..." : "Registrar movimiento"}
      </Button>
    </form>
  );
}

export function EditTransactionForm({
  transaction,
  categories,
  accounts,
}: {
  transaction: TransactionValues;
  categories: CategoryOption[];
  accounts: AccountOption[];
}) {
  const router = useRouter();
  const close = useCreatePlusClose();
  const [state, action, pending] = useActionState(updateTransactionAction, null);
  const isTransfer = isTransferMovement(transaction.transferKind);

  useEffect(() => {
    if (state?.success) {
      close?.();
      router.refresh();
    }
  }, [state, close, router]);

  if (categories.length === 0 || accounts.length === 0) {
    return (
      <p className="text-sm text-muted">
        Primero creá al menos un concepto y una cuenta (origen/destino).
      </p>
    );
  }

  const accountOptions =
    transaction.accountId && !accounts.some((item) => item.id === transaction.accountId)
      ? accounts
      : accounts;

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="id" value={transaction.id} />
      <MovementFormBody
        categories={categories}
        accounts={accountOptions}
        lockEntryKind={isTransfer ? "transfer" : "cash"}
        defaults={{
          entryKind: isTransfer ? "transfer" : "cash",
          direction: transaction.incomeAmount > 0 ? "income" : "expense",
          amount: String(
            transaction.incomeAmount > 0
              ? transaction.incomeAmount
              : transaction.expenseAmount,
          ),
          accountId: transaction.accountId ?? accounts[0]?.id,
          categoryId: transaction.categoryId,
          date: toDateInputValue(new Date(transaction.date)),
          currency: transaction.currency,
          note: transaction.note,
          transferKind: isTransfer
            ? (transaction.transferKind as TransferDirection)
            : "investment",
          operatingAccountId: transaction.operatingAccountId,
          instrumentAccountId: transaction.instrumentAccountId,
        }}
      />
      <FormMessage state={state} />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Guardando..." : "Guardar cambios"}
      </Button>
    </form>
  );
}
