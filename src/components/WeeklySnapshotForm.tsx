"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  updateWeeklySnapshotAction,
  upsertWeeklySnapshotAction,
} from "@/actions/weekly-snapshots";
import { useCreatePlusClose } from "@/components/CreatePlusModal";
import { Button, Field, FormMessage, Input, Select } from "@/components/ui";
import { convertHoldingAmount, nativeHoldingAmount } from "@/lib/finance";
import { formatDate, formatMoney, parseAmount } from "@/lib/format";

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

type SnapshotValues = {
  id: string;
  accountId: string;
  weekDate: string;
  currency: "ARS" | "USD";
  amountArs: number;
  amountUsd: number;
};

function accountCurrency(account?: AccountOption): "ARS" | "USD" {
  return account?.currency === "USD" ? "USD" : "ARS";
}

function formatFx(value: number) {
  return value.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function weekLabel(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return formatDate(new Date(year, month - 1, day));
}

function SnapshotFields({
  accounts,
  bnaFx,
  mondays,
  defaults,
}: {
  accounts: AccountOption[];
  bnaFx: BnaFx;
  mondays: string[];
  defaults?: Partial<SnapshotValues>;
}) {
  const [accountId, setAccountId] = useState(
    defaults?.accountId ?? accounts[0]?.id ?? "",
  );
  const [currency, setCurrency] = useState<"ARS" | "USD">(
    defaults?.currency ??
      accountCurrency(
        accounts.find((item) => item.id === (defaults?.accountId ?? accounts[0]?.id)),
      ),
  );
  const [amount, setAmount] = useState(() => {
    if (defaults?.amountArs == null && defaults?.amountUsd == null) {
      return "";
    }
    return String(
      nativeHoldingAmount({
        currency: defaults?.currency ?? "ARS",
        amountArs: defaults?.amountArs ?? 0,
        amountUsd: defaults?.amountUsd ?? 0,
      }),
    );
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

  const weekDates = mondays.includes(defaults?.weekDate ?? "")
    ? mondays
    : defaults?.weekDate
      ? [defaults.weekDate, ...mondays]
      : mondays;

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
      <Field label="Lunes">
        <Select name="weekDate" defaultValue={defaults?.weekDate ?? weekDates[weekDates.length - 1]}>
          {weekDates.map((date) => (
            <option key={date} value={date}>
              {weekLabel(date)}
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
              {formatFx(bnaFx.sell)}
            </>
          ) : (
            <>
              Equivalente {formatMoney(converted.amountArs)} · TC BNA compra{" "}
              {formatFx(bnaFx.buy)}
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

export function WeeklySnapshotForm({
  accounts,
  bnaFx,
  mondays,
  defaults,
}: {
  accounts: AccountOption[];
  bnaFx: BnaFx;
  mondays: string[];
  defaults?: Partial<SnapshotValues>;
}) {
  const router = useRouter();
  const close = useCreatePlusClose();
  const [state, action, pending] = useActionState(upsertWeeklySnapshotAction, null);

  useEffect(() => {
    if (state?.success) {
      close?.();
      router.refresh();
    }
  }, [state, close, router]);

  if (accounts.length === 0 || mondays.length === 0) {
    return <p className="text-sm text-muted">No hay un lunes disponible para cargar.</p>;
  }

  return (
    <form action={action} className="grid gap-4">
      <SnapshotFields
        accounts={accounts}
        bnaFx={bnaFx}
        mondays={mondays}
        defaults={defaults}
      />
      <FormMessage state={state} />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Guardando..." : "Guardar saldo del lunes"}
      </Button>
    </form>
  );
}

export function EditWeeklySnapshotForm({
  accounts,
  bnaFx,
  mondays,
  snapshot,
}: {
  accounts: AccountOption[];
  bnaFx: BnaFx;
  mondays: string[];
  snapshot: SnapshotValues;
}) {
  const router = useRouter();
  const close = useCreatePlusClose();
  const [state, action, pending] = useActionState(updateWeeklySnapshotAction, null);

  useEffect(() => {
    if (state?.success) {
      close?.();
      router.refresh();
    }
  }, [state, close, router]);

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="id" value={snapshot.id} />
      <SnapshotFields
        accounts={accounts}
        bnaFx={bnaFx}
        mondays={mondays}
        defaults={snapshot}
      />
      <FormMessage state={state} />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Guardando..." : "Guardar cambios"}
      </Button>
    </form>
  );
}
