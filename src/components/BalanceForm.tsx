"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { upsertAccountBalanceAction } from "@/actions/balances";
import { useCreatePlusClose } from "@/components/CreatePlusModal";
import { Button, Field, FormMessage, Input, Select } from "@/components/ui";
import { currentYearMonth } from "@/lib/format";

type AccountOption = {
  id: string;
  name: string;
  currency: string;
};

export function BalanceForm({ accounts }: { accounts: AccountOption[] }) {
  const router = useRouter();
  const close = useCreatePlusClose();
  const [state, action, pending] = useActionState(upsertAccountBalanceAction, null);
  const now = currentYearMonth();

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
      <Field label="Cuenta">
        <Select name="accountId" required>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Momento">
        <Select name="kind" defaultValue="start">
          <option value="start">Inicio de mes</option>
          <option value="end">Fin de mes</option>
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Año">
          <Input name="year" type="number" defaultValue={now.year} required />
        </Field>
        <Field label="Mes">
          <Select name="month" defaultValue={String(now.month)}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
              <option key={month} value={month}>
                {month}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Monto ARS">
        <Input name="amountArs" inputMode="decimal" placeholder="0" />
      </Field>
      <Field label="Monto USD">
        <Input name="amountUsd" inputMode="decimal" placeholder="0" />
      </Field>
      <FormMessage state={state} />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Guardando..." : "Guardar tenencia"}
      </Button>
    </form>
  );
}
