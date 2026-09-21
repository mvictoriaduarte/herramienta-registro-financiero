"use client";

import { useActionState } from "react";
import { loginAction } from "@/actions/auth";
import { Button, Field, FormMessage, Input } from "@/components/ui";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, null);

  return (
    <form action={action} className="space-y-5">
      <Field label="Usuario">
        <Input name="username" autoComplete="username" required />
      </Field>
      <Field label="Contraseña">
        <Input name="password" type="password" autoComplete="current-password" required />
      </Field>
      <FormMessage state={state} />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Entrando..." : "Entrar"}
      </Button>
    </form>
  );
}
