"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createAccountAction, updateAccountAction } from "@/actions/accounts";
import { useCreatePlusClose } from "@/components/CreatePlusModal";
import { Button, Field, FormMessage, Input, Select } from "@/components/ui";
import { parseAccountPurpose, parseBankRole } from "@/lib/finance";
import {
  ACCOUNT_BANK_ROLE_LABELS,
  ACCOUNT_PURPOSE_LABELS,
  type AccountBankRole,
  type AccountPurpose,
} from "@/lib/types";

type AccountValues = {
  id: string;
  name: string;
  currency: string;
  purpose: AccountPurpose;
  tracksYield: boolean;
  bankName: string;
  bankRole: AccountBankRole;
  isDefault: boolean;
};

function FlagToggle({
  name,
  checked,
  onChange,
  title,
  description,
}: {
  name: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-white/40 px-4 py-3">
      <div>
        <p className="text-sm font-medium text-ink">{title}</p>
        <p className="text-xs text-muted">{description}</p>
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
      <input type="hidden" name={name} value={checked ? "on" : ""} />
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

function BankRolePicker({
  value,
  onChange,
}: {
  value: Exclude<AccountBankRole, "none">;
  onChange: (next: Exclude<AccountBankRole, "none">) => void;
}) {
  return (
    <div className="block space-y-2">
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
        Rol en el banco
      </span>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {(["operating", "instrument"] as const).map((role) => {
          const selected = value === role;
          return (
            <button
              key={role}
              type="button"
              onClick={() => onChange(role)}
              className={`rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${
                selected
                  ? "bg-petroleum text-white"
                  : "bg-white/40 text-ink hover:bg-white/70"
              }`}
            >
              {ACCOUNT_BANK_ROLE_LABELS[role]}
            </button>
          );
        })}
      </div>
      <input type="hidden" name="bankRole" value={value} />
    </div>
  );
}

function AccountFields({
  defaults,
  knownBanks = [],
}: {
  defaults?: Partial<AccountValues>;
  knownBanks?: string[];
}) {
  const [isDefault, setIsDefault] = useState(Boolean(defaults?.isDefault));
  const [tracksYield, setTracksYield] = useState(Boolean(defaults?.tracksYield));
  const [purpose, setPurpose] = useState<AccountPurpose>(
    parseAccountPurpose(defaults?.purpose),
  );
  const initialRole = parseBankRole(defaults?.bankRole);
  const [banking, setBanking] = useState(
    Boolean(defaults?.bankName) && initialRole !== "none",
  );
  const [bankRole, setBankRole] = useState<Exclude<AccountBankRole, "none">>(
    initialRole === "instrument" ? "instrument" : "operating",
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
      <FlagToggle
        name="banking"
        checked={banking}
        onChange={setBanking}
        title="Cuenta bancaria"
        description="Permite inversiones y rescates entre la caja y un instrumento del mismo banco"
      />
      {banking ? (
        <>
          <Field label="Banco">
            <Input
              name="bankName"
              placeholder="Santander"
              required
              defaultValue={defaults?.bankName ?? ""}
              list="known-banks"
            />
            {knownBanks.length > 0 ? (
              <datalist id="known-banks">
                {knownBanks.map((bank) => (
                  <option key={bank} value={bank} />
                ))}
              </datalist>
            ) : null}
          </Field>
          <BankRolePicker value={bankRole} onChange={setBankRole} />
        </>
      ) : (
        <>
          <input type="hidden" name="bankName" value="" />
          <input type="hidden" name="bankRole" value="none" />
        </>
      )}
      <FlagToggle
        name="tracksYield"
        checked={tracksYield}
        onChange={setTracksYield}
        title="Rendimiento semanal"
        description="Cargar el saldo cada lunes y comparar contra la semana anterior"
      />
      <FlagToggle
        name="isDefault"
        checked={isDefault}
        onChange={setIsDefault}
        title="Cuenta por defecto"
        description="Se preselecciona como origen/destino en movimientos"
      />
    </>
  );
}

export function AccountForm({ knownBanks = [] }: { knownBanks?: string[] }) {
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
      <AccountFields knownBanks={knownBanks} />
      <FormMessage state={state} />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Guardando..." : "Agregar cuenta"}
      </Button>
    </form>
  );
}

export function EditAccountForm({
  account,
  knownBanks = [],
}: {
  account: AccountValues;
  knownBanks?: string[];
}) {
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
      <AccountFields defaults={account} knownBanks={knownBanks} />
      <FormMessage state={state} />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Guardando..." : "Guardar cambios"}
      </Button>
    </form>
  );
}
