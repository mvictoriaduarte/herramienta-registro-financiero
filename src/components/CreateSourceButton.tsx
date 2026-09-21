"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createIncomeSourceAction } from "@/actions/income";
import { ColorPickerField } from "@/components/ColorPickerField";
import { Button, Field, FormMessage, Input, Select } from "@/components/ui";
import { nextSourceColor } from "@/lib/finance";
import { BILLING_MODE_LABELS, type BillingMode } from "@/lib/types";

export function CreateSourceButton({
  usedColors = [],
  bnaSell = null,
}: {
  usedColors?: string[];
  bnaSell?: number | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [state, action, pending] = useActionState(createIncomeSourceAction, null);
  const formRef = useRef<HTMLFormElement>(null);
  const defaultColor = nextSourceColor(usedColors);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (state?.success) {
      setOpen(false);
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const modal =
    open && mounted
      ? createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <button
              type="button"
              className="absolute inset-0 bg-petroleum-deep/35 backdrop-blur-sm"
              aria-label="Cerrar"
              onClick={() => setOpen(false)}
            />
            <div className="glass-panel relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[28px] p-6 shadow-2xl sm:p-8">
              <div className="mb-6 flex items-start justify-between gap-4">
                <h2 className="font-display text-3xl text-petroleum">Crear fuente</h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Cerrar"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-white/60 hover:text-petroleum"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>

              <form ref={formRef} action={action} className="grid gap-4">
                <Field label="Nombre">
                  <Input name="name" placeholder="Quantum, Axis, Otros..." required />
                </Field>
                <Field label="Modalidad de cobro">
                  <Select name="billingMode" defaultValue="hourly">
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
                    placeholder={
                      bnaSell
                        ? `BNA venta ${bnaSell.toLocaleString("es-AR")}`
                        : "Vacío = usa TC BNA automático"
                    }
                  />
                </Field>
                <p className="-mt-2 text-xs text-muted">
                  Si lo dejás vacío, se usa la venta BNA del día.
                </p>
                <ColorPickerField defaultValue={defaultColor} />
                <Field label="Logo (opcional)">
                  <Input
                    name="logo"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                  />
                </Field>
                <FormMessage state={state} />
                <Button type="submit" disabled={pending} className="w-full">
                  {pending ? "Creando..." : "Crear fuente"}
                </Button>
              </form>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-petroleum text-2xl font-light leading-none text-white shadow-[0_12px_28px_rgba(14,74,90,0.28)] transition duration-500 hover:-translate-y-0.5 hover:bg-petroleum-deep"
        aria-label="Crear fuente de ingresos"
      >
        +
      </button>
      {modal}
    </>
  );
}
