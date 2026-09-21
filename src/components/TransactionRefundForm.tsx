"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  addTransactionRefundAction,
  updateTransactionRefundAction,
} from "@/actions/transactions";
import { useCreatePlusClose } from "@/components/CreatePlusModal";
import { Button, Field, FormMessage, Input } from "@/components/ui";
import { toDateInputValue } from "@/lib/format";

export function TransactionRefundForm({
  transactionId,
  remaining,
  currency,
  defaults,
}: {
  transactionId: string;
  remaining: number;
  currency: string;
  defaults?: {
    id: string;
    amount: number;
    note: string;
    date: string | null;
  };
}) {
  const router = useRouter();
  const close = useCreatePlusClose();
  const isEdit = Boolean(defaults?.id);
  const [state, action, pending] = useActionState(
    isEdit ? updateTransactionRefundAction : addTransactionRefundAction,
    null,
  );

  useEffect(() => {
    if (state?.success) {
      close?.();
      router.refresh();
    }
  }, [state, close, router]);

  const dateDefault = defaults?.date
    ? toDateInputValue(new Date(defaults.date))
    : toDateInputValue();

  return (
    <form action={action} className="grid gap-4">
      {isEdit ? (
        <input type="hidden" name="refundId" value={defaults!.id} />
      ) : (
        <input type="hidden" name="transactionId" value={transactionId} />
      )}
      <p className="text-sm text-muted">
        {isEdit ? "Máximo permitido" : "Pendiente de devolver"}:{" "}
        <span className="font-semibold text-petroleum">
          {remaining.toLocaleString("es-AR", {
            style: "currency",
            currency: currency === "USD" ? "USD" : "ARS",
            maximumFractionDigits: 2,
          })}
        </span>
      </p>
      <Field label="Monto devuelto">
        <Input
          name="amount"
          inputMode="decimal"
          placeholder={String(remaining)}
          defaultValue={defaults ? String(defaults.amount) : undefined}
          required
        />
      </Field>
      <Field label="Fecha (opcional)">
        <Input name="date" type="date" defaultValue={dateDefault} />
      </Field>
      <Field label="Nota (opcional)">
        <Input
          name="note"
          placeholder="Dev. Isa, parcial, etc."
          defaultValue={defaults?.note ?? ""}
        />
      </Field>
      <FormMessage state={state} />
      <Button type="submit" disabled={pending || remaining <= 0} className="w-full">
        {pending
          ? "Guardando..."
          : isEdit
            ? "Guardar cambios"
            : "Registrar devolución"}
      </Button>
    </form>
  );
}
