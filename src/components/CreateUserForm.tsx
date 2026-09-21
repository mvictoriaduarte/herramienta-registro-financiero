"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createUserAction } from "@/actions/users";
import { useCreatePlusClose } from "@/components/CreatePlusModal";
import { Button, Field, FormMessage, Input } from "@/components/ui";

export function CreateUserForm() {
  const router = useRouter();
  const close = useCreatePlusClose();
  const [state, action, pending] = useActionState(createUserAction, null);

  useEffect(() => {
    if (state?.success) {
      close?.();
      router.refresh();
    }
  }, [state, close, router]);

  return (
    <form action={action} className="grid gap-4">
      <Field label="Usuario">
        <Input name="username" autoComplete="off" required />
      </Field>
      <Field label="Contraseña">
        <Input name="password" type="password" autoComplete="new-password" required />
      </Field>
      <Field label="Confirmar contraseña">
        <Input name="confirmPassword" type="password" autoComplete="new-password" required />
      </Field>
      <p className="text-sm leading-6 text-muted">
        Después no vas a poder ver los movimientos ni las categorías de esa persona.
      </p>
      <FormMessage state={state} />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Creando..." : "Crear perfil"}
      </Button>
    </form>
  );
}
