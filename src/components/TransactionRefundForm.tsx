"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { addTransactionRefundAction } from "@/actions/transactions";
import { useCreatePlusClose } from "@/components/CreatePlusModal";
import { Button, Field, FormMessage, Input } from "@/components/ui";
import { toDateInputValue } from "@/lib/format";

export function TransactionRefundForm({
  transactionId,
  remaining,
  currency,
}: {
  transactionId: string;
  remaining: number;
  currency: string;
}) {
  const router = useRouter();
  const close = useCreatePlusClose();
  const [state, action, pending] = useActionState(addTransactionRefundAction, null);

  useEffect(() => {
    if (state?.success) {
      close?.();
      router.refresh();
    }
  }, [state, close, router]);

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="transactionId" value={transactionId} />
      <p className="text-sm text-muted">
        Pendiente de devolver:{" "}
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
          required
        />
      </Field>
      <Field label="Fecha (opcional)">
        <Input name="date" type="date" defaultValue={toDateInputValue()} />
      </Field>
      <Field label="Nota (opcional)">
        <Input name="note" placeholder="Dev. Isa, parcial, etc." />
      </Field>
      <FormMessage state={state} />
      <Button type="submit" disabled={pending || remaining <= 0} className="w-full">
        {pending ? "Guardando..." : "Registrar devolución"}
      </Button>
    </form>
  );
}
