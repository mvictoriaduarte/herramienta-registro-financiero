"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  addIncomeAdjustmentAction,
  updateIncomeSourceAction,
  upsertIncomePeriodAction,
} from "@/actions/income";
import { ColorPickerField } from "@/components/ColorPickerField";
import { useCreatePlusClose } from "@/components/CreatePlusModal";
import { Button, Field, FormMessage, Input, Select } from "@/components/ui";
import { billingUnitLabel, billingValueLabel } from "@/lib/finance";
import { currentYearMonth } from "@/lib/format";
import { BILLING_MODE_LABELS, type BillingMode } from "@/lib/types";

export function IncomeSourceSettingsForm({
  source,
  bnaSell = null,
  onSaved,
}: {
  source: {
    id: string;
    name: string;
    billingMode: string;
    color: string;
    logoUrl?: string | null;
    defaultFxRate: number | null;
  };
  bnaSell?: number | null;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const close = useCreatePlusClose();
  const [state, action, pending] = useActionState(updateIncomeSourceAction, null);

  useEffect(() => {
    if (state?.success) {
      close?.();
      onSaved?.();
      router.refresh();
    }
  }, [state, close, onSaved, router]);

  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      <input type="hidden" name="id" value={source.id} />
      <Field label="Nombre">
        <Input name="name" defaultValue={source.name} required />
      </Field>
      <Field label="Modalidad">
        <Select name="billingMode" defaultValue={source.billingMode}>
          {(Object.keys(BILLING_MODE_LABELS) as BillingMode[]).map((mode) => (
            <option key={mode} value={mode}>
              {BILLING_MODE_LABELS[mode]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="TC manual (opcional)">
        <Input
          name="defaultFxRate"
          inputMode="decimal"
          defaultValue={source.defaultFxRate ?? ""}
          placeholder={
            bnaSell
              ? `BNA venta ${bnaSell.toLocaleString("es-AR")}`
              : "Vacío = usa TC BNA automático"
          }
        />
      </Field>
      <p className="md:col-span-2 -mt-2 text-xs text-muted">
        {bnaSell
          ? `Hoy BNA venta ${bnaSell.toLocaleString("es-AR", { minimumFractionDigits: 2 })}. Dejá vacío para usarlo automáticamente.`
          : "Si lo dejás vacío, se usa la venta BNA del día."}
      </p>
      <Field label="Logo (opcional)">
        <Input name="logo" type="file" accept="image/png,image/jpeg,image/webp,image/gif" />
      </Field>
      {source.logoUrl ? (
        <label className="md:col-span-2 flex items-center gap-3 text-sm text-petroleum">
          <input type="checkbox" name="removeLogo" className="h-4 w-4 accent-[var(--petroleum)]" />
          Quitar logo actual y volver a las iniciales
        </label>
      ) : null}
      <div className="md:col-span-2">
        <ColorPickerField defaultValue={source.color} />
      </div>
      <div className="md:col-span-2 space-y-4">
        <FormMessage state={state} />
        <Button
          type="submit"
          disabled={pending}
          style={{ backgroundColor: source.color }}
        >
          {pending ? "Guardando..." : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}

export function IncomePeriodForm({
  sourceId,
  billingMode,
  accentColor,
}: {
  sourceId: string;
  billingMode: string;
  accentColor?: string;
}) {
  const router = useRouter();
  const close = useCreatePlusClose();
  const [state, action, pending] = useActionState(upsertIncomePeriodAction, null);
  const now = currentYearMonth();
  const mode = billingMode as BillingMode;
  const unitLabel = billingUnitLabel(mode);
  const valueLabel = billingValueLabel(mode);

  useEffect(() => {
    if (state?.success) {
      close?.();
      router.refresh();
    }
  }, [state, close, router]);

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="sourceId" value={sourceId} />
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
      {mode === "monthly" ? (
        <Field label={valueLabel}>
          <Input name="fixedAmount" inputMode="decimal" placeholder="1500000" required />
        </Field>
      ) : (
        <>
          <Field label={unitLabel ?? "Cantidad"}>
            <Input
              name="units"
              inputMode="decimal"
              placeholder={mode === "project" ? "1" : "160"}
              required
            />
          </Field>
          <Field label={valueLabel}>
            <Input
              name="unitValue"
              inputMode="decimal"
              placeholder={mode === "project" ? "500000" : "11500"}
              required
            />
          </Field>
        </>
      )}
      <FormMessage state={state} />
      <Button
        type="submit"
        disabled={pending}
        className="w-full"
        style={accentColor ? { backgroundColor: accentColor } : undefined}
      >
        {pending ? "Guardando..." : "Registrar período"}
      </Button>
    </form>
  );
}

export function IncomeAdjustmentForm({
  periodId,
  accentColor,
}: {
  periodId: string;
  accentColor?: string;
}) {
  const router = useRouter();
  const close = useCreatePlusClose();
  const [state, action, pending] = useActionState(addIncomeAdjustmentAction, null);

  useEffect(() => {
    if (state?.success) {
      close?.();
      router.refresh();
    }
  }, [state, close, router]);

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="periodId" value={periodId} />
      <Field label="Adicional">
        <Input name="name" placeholder="Monotributo, IA, aguinaldo..." required />
      </Field>
      <Field label="Monto">
        <Input name="amount" inputMode="decimal" placeholder="-50000" required />
      </Field>
      <FormMessage state={state} />
      <Button
        type="submit"
        disabled={pending}
        className="w-full"
        style={accentColor ? { backgroundColor: accentColor } : undefined}
      >
        {pending ? "Guardando..." : "Sumar adicional"}
      </Button>
    </form>
  );
}
