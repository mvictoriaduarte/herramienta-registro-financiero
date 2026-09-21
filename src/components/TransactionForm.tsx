"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createTransactionAction,
  updateTransactionAction,
} from "@/actions/transactions";
import { useCreatePlusClose } from "@/components/CreatePlusModal";
import { Button, Field, FormMessage, Input, Select } from "@/components/ui";
import { isExpenseLike, isIncomeCategory } from "@/lib/finance";
import { toDateInputValue } from "@/lib/format";

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
};

type AmountDirection = "income" | "expense";

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
};

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
      <TransactionFields categories={categories} accounts={accounts} />
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
      <TransactionFields
        categories={categories}
        accounts={accountOptions}
        defaults={{
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
        }}
      />
      <FormMessage state={state} />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Guardando..." : "Guardar cambios"}
      </Button>
    </form>
  );
}
