"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createAccountAction, updateAccountAction } from "@/actions/accounts";
import { useCreatePlusClose } from "@/components/CreatePlusModal";
import { Button, Field, FormMessage, Input, Select } from "@/components/ui";
import { parseAccountPurpose } from "@/lib/finance";
import {
  ACCOUNT_PURPOSE_LABELS,
  type AccountPurpose,
} from "@/lib/types";

type AccountValues = {
  id: string;
  name: string;
  currency: string;
  purpose: AccountPurpose;
  isDefault: boolean;
};

function DefaultToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-white/40 px-4 py-3">
      <div>
        <p className="text-sm font-medium text-ink">Cuenta por defecto</p>
        <p className="text-xs text-muted">
          Se preselecciona como origen/destino en movimientos
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-8 w-14 shrink-0 rounded-full transition ${
          checked ? "bg-petroleum" : "bg-white/70"
        }`}
      >
        <span
          className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition ${
            checked ? "left-7" : "left-1"
          }`}
        />
      </button>
      <input type="hidden" name="isDefault" value={checked ? "on" : ""} />
    </div>
  );
}

function PurposePicker({
  value,
  onChange,
}: {
  value: AccountPurpose;
  onChange: (next: AccountPurpose) => void;
}) {
  return (
    <div className="block space-y-2">
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
        Tipo de cuenta
      </span>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {(["spending", "savings"] as const).map((purpose) => {
          const selected = value === purpose;
          return (
            <button
              key={purpose}
              type="button"
              onClick={() => onChange(purpose)}
              className={`rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${
                selected
                  ? "bg-petroleum text-white"
                  : "bg-white/40 text-ink hover:bg-white/70"
              }`}
            >
              {ACCOUNT_PURPOSE_LABELS[purpose]}
            </button>
          );
        })}
      </div>
      <input type="hidden" name="purpose" value={value} />
    </div>
  );
}

function AccountFields({
  defaults,
}: {
  defaults?: Partial<AccountValues>;
}) {
  const [isDefault, setIsDefault] = useState(Boolean(defaults?.isDefault));
  const [purpose, setPurpose] = useState<AccountPurpose>(
    parseAccountPurpose(defaults?.purpose),
  );

  return (
    <>
      <Field label="Nombre">
        <Input
          name="name"
          placeholder="Caja de Ahorro Santander (ARS)"
          required
          defaultValue={defaults?.name ?? ""}
        />
      </Field>
      <Field label="Moneda">
        <Select name="currency" defaultValue={defaults?.currency ?? "ARS"}>
          <option value="ARS">ARS</option>
          <option value="USD">USD</option>
        </Select>
      </Field>
      <PurposePicker value={purpose} onChange={setPurpose} />
      <DefaultToggle checked={isDefault} onChange={setIsDefault} />
    </>
  );
}

export function AccountForm() {
  const router = useRouter();
  const close = useCreatePlusClose();
  const [state, action, pending] = useActionState(createAccountAction, null);

  useEffect(() => {
    if (state?.success) {
      close?.();
      router.refresh();
    }
  }, [state, close, router]);

  return (
    <form action={action} className="grid gap-4">
      <AccountFields />
      <FormMessage state={state} />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Guardando..." : "Agregar cuenta"}
      </Button>
    </form>
  );
}

export function EditAccountForm({ account }: { account: AccountValues }) {
  const router = useRouter();
  const close = useCreatePlusClose();
  const [state, action, pending] = useActionState(updateAccountAction, null);

  useEffect(() => {
    if (state?.success) {
      close?.();
      router.refresh();
    }
  }, [state, close, router]);

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="id" value={account.id} />
      <AccountFields defaults={account} />
      <FormMessage state={state} />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Guardando..." : "Guardar cambios"}
      </Button>
    </form>
  );
}
