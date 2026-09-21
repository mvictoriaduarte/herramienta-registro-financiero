"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  updateAccountBalanceAction,
  upsertAccountBalanceAction,
} from "@/actions/balances";
import { useCreatePlusClose } from "@/components/CreatePlusModal";
import { Button, Field, FormMessage, Input, Select } from "@/components/ui";
import { convertHoldingAmount, nativeHoldingAmount } from "@/lib/finance";
import { currentYearMonth, formatMoney, parseAmount } from "@/lib/format";

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

type BalanceValues = {
  id: string;
  accountId: string;
  year: number;
  month: number;
  kind: "start" | "end";
  currency: "ARS" | "USD";
  amountArs: number;
  amountUsd: number;
};

function accountCurrency(account?: AccountOption): "ARS" | "USD" {
  return account?.currency === "USD" ? "USD" : "ARS";
}

function formatFx(value: number) {
  return value.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function BalanceFields({
  accounts,
  bnaFx,
  defaults,
}: {
  accounts: AccountOption[];
  bnaFx: BnaFx;
  defaults?: Partial<BalanceValues>;
}) {
  const now = currentYearMonth();
  const [accountId, setAccountId] = useState(
    defaults?.accountId ?? accounts[0]?.id ?? "",
  );
  const [currency, setCurrency] = useState<"ARS" | "USD">(
    defaults?.currency ??
      accountCurrency(accounts.find((item) => item.id === (defaults?.accountId ?? accounts[0]?.id))),
  );
  const [amount, setAmount] = useState(() => {
    if (defaults?.amountArs == null && defaults?.amountUsd == null) {
      return "";
    }
    return String(nativeHoldingAmount({
      currency: defaults?.currency ?? "ARS",
      amountArs: defaults?.amountArs ?? 0,
      amountUsd: defaults?.amountUsd ?? 0,
    }));
  });

  const parsedAmount = useMemo(() => {
    const raw = amount.trim();
    if (!raw) {
      return 0;
    }
    const value = parseAmount(raw);
    return Number.isFinite(value) && value >= 0 ? value : NaN;
  }, [amount]);

  const converted = Number.isNaN(parsedAmount)
    ? null
    : convertHoldingAmount(parsedAmount, currency, bnaFx);

  return (
    <>
      <Field label="Cuenta">
        <Select
          name="accountId"
          required
          value={accountId}
          onChange={(event) => {
            const nextId = event.target.value;
            setAccountId(nextId);
            setCurrency(accountCurrency(accounts.find((item) => item.id === nextId)));
          }}
        >
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Moneda">
        <Select
          name="currency"
          value={currency}
          onChange={(event) =>
            setCurrency(event.target.value === "USD" ? "USD" : "ARS")
          }
        >
          <option value="ARS">ARS</option>
          <option value="USD">USD</option>
        </Select>
      </Field>
      <Field label="Momento">
        <Select name="kind" defaultValue={defaults?.kind ?? "start"}>
          <option value="start">Inicio de mes</option>
          <option value="end">Fin de mes</option>
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Año">
          <Input
            name="year"
            type="number"
            defaultValue={defaults?.year ?? now.year}
            required
          />
        </Field>
        <Field label="Mes">
          <Select name="month" defaultValue={String(defaults?.month ?? now.month)}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
              <option key={month} value={month}>
                {month}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label={currency === "USD" ? "Monto USD" : "Monto ARS"}>
        <Input
          name="amount"
          inputMode="decimal"
          placeholder="0"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
      </Field>
      {converted && bnaFx ? (
        <p className="rounded-2xl bg-white/40 px-4 py-3 text-sm text-muted">
          {currency === "ARS" ? (
            <>
              Equivalente {formatMoney(converted.amountUsd, "USD")} · TC BNA venta{" "}
              {formatFx(bnaFx.sell)} (comprás dólares)
            </>
          ) : (
            <>
              Equivalente {formatMoney(converted.amountArs)} · TC BNA compra{" "}
              {formatFx(bnaFx.buy)} (vendés dólares)
            </>
          )}
        </p>
      ) : (
        <p className="text-sm text-muted">
          {Number.isNaN(parsedAmount)
            ? "El monto no es válido."
            : "Sin tipo de cambio BNA para calcular el equivalente."}
        </p>
      )}
    </>
  );
}

export function BalanceForm({
  accounts,
  bnaFx,
  defaults,
}: {
  accounts: AccountOption[];
  bnaFx: BnaFx;
  defaults?: Partial<BalanceValues>;
}) {
  const router = useRouter();
  const close = useCreatePlusClose();
  const [state, action, pending] = useActionState(upsertAccountBalanceAction, null);

  useEffect(() => {
    if (state?.success) {
      close?.();
      router.refresh();
    }
  }, [state, close, router]);

  if (accounts.length === 0) {
    return <p className="text-sm text-muted">Creá una cuenta para cargar tenencias.</p>;
  }

  return (
    <form action={action} className="grid gap-4">
      <BalanceFields accounts={accounts} bnaFx={bnaFx} defaults={defaults} />
      <FormMessage state={state} />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Guardando..." : "Guardar tenencia"}
      </Button>
    </form>
  );
}

export function EditBalanceForm({
  accounts,
  balance,
  bnaFx,
}: {
  accounts: AccountOption[];
  balance: BalanceValues;
  bnaFx: BnaFx;
}) {
  const router = useRouter();
  const close = useCreatePlusClose();
  const [state, action, pending] = useActionState(updateAccountBalanceAction, null);

  useEffect(() => {
    if (state?.success) {
      close?.();
      router.refresh();
    }
  }, [state, close, router]);

  if (accounts.length === 0) {
    return <p className="text-sm text-muted">Creá una cuenta para cargar tenencias.</p>;
  }

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="id" value={balance.id} />
      <BalanceFields accounts={accounts} bnaFx={bnaFx} defaults={balance} />
      <FormMessage state={state} />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Guardando..." : "Guardar cambios"}
      </Button>
    </form>
  );
}
