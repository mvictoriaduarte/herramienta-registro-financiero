"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  updateIncomeSourceAction,
  upsertIncomePeriodAction,
} from "@/actions/income";
import { ColorPickerField } from "@/components/ColorPickerField";
import { useCreatePlusClose } from "@/components/CreatePlusModal";
import { Button, Field, FormMessage, Input, Select } from "@/components/ui";
import { billingUnitLabel, billingValueLabel } from "@/lib/finance";
import { toDateInputValue } from "@/lib/format";
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
  defaults,
}: {
  sourceId: string;
  billingMode: string;
  accentColor?: string;
  defaults?: {
    id?: string;
    date: string;
    note?: string;
    units: number | null;
    unitValue: number | null;
    fixedAmount: number | null;
    adjustments?: { name: string; amount: number }[];
  };
}) {
  const router = useRouter();
  const close = useCreatePlusClose();
  const [state, action, pending] = useActionState(upsertIncomePeriodAction, null);
  const mode = billingMode as BillingMode;
  const unitLabel = billingUnitLabel(mode);
  const valueLabel = billingValueLabel(mode);
  const isEdit = Boolean(defaults?.id);
  const [adjustments, setAdjustments] = useState<
    { key: string; name: string; amount: string }[]
  >(() =>
    (defaults?.adjustments ?? []).map((item, index) => ({
      key: `adj-${index}`,
      name: item.name,
      amount: String(item.amount),
    })),
  );

  useEffect(() => {
    if (state?.success) {
      close?.();
      router.refresh();
    }
  }, [state, close, router]);

  function addAdjustment() {
    setAdjustments((prev) => [
      ...prev,
      { key: `adj-${Date.now()}-${prev.length}`, name: "", amount: "" },
    ]);
  }

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="sourceId" value={sourceId} />
      {defaults?.id ? <input type="hidden" name="id" value={defaults.id} /> : null}
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
      {mode === "monthly" ? (
        <Field label={valueLabel}>
          <Input
            name="fixedAmount"
            inputMode="decimal"
            placeholder="1500000"
            required
            defaultValue={
              defaults?.fixedAmount != null ? String(defaults.fixedAmount) : ""
            }
          />
        </Field>
      ) : (
        <>
          <Field label={unitLabel ?? "Cantidad"}>
            <Input
              name="units"
              inputMode="decimal"
              placeholder={mode === "project" ? "1" : "160"}
              required
              defaultValue={defaults?.units != null ? String(defaults.units) : ""}
            />
          </Field>
          <Field label={valueLabel}>
            <Input
              name="unitValue"
              inputMode="decimal"
              placeholder={mode === "project" ? "500000" : "11500"}
              required
              defaultValue={
                defaults?.unitValue != null ? String(defaults.unitValue) : ""
              }
            />
          </Field>
        </>
      )}

      <div className="space-y-2">
        <button
          type="button"
          onClick={addAdjustment}
          className="w-full rounded-2xl bg-petroleum px-4 py-3 text-sm font-semibold text-white transition hover:bg-petroleum-deep"
        >
          Agregar adicional
        </button>
        {adjustments.map((row) => (
          <div
            key={row.key}
            className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_8rem_auto] sm:items-center"
          >
            <Input
              name="adjName"
              placeholder="Nombre del adicional"
              value={row.name}
              onChange={(event) =>
                setAdjustments((prev) =>
                  prev.map((item) =>
                    item.key === row.key
                      ? { ...item, name: event.target.value }
                      : item,
                  ),
                )
              }
            />
            <Input
              name="adjAmount"
              inputMode="decimal"
              placeholder="Monto"
              value={row.amount}
              onChange={(event) =>
                setAdjustments((prev) =>
                  prev.map((item) =>
                    item.key === row.key
                      ? { ...item, amount: event.target.value }
                      : item,
                  ),
                )
              }
            />
            <button
              type="button"
              aria-label="Quitar adicional"
              onClick={() =>
                setAdjustments((prev) => prev.filter((item) => item.key !== row.key))
              }
              className="inline-flex h-11 items-center justify-center rounded-2xl px-3 text-sm font-semibold text-rose-700 hover:bg-rose-50/80"
            >
              Quitar
            </button>
          </div>
        ))}
      </div>

      <FormMessage state={state} />
      <Button
        type="submit"
        disabled={pending}
        className="w-full"
        style={accentColor ? { backgroundColor: accentColor } : undefined}
      >
        {pending ? "Guardando..." : isEdit ? "Guardar cambios" : "Registrar ingreso"}
      </Button>
    </form>
  );
}
