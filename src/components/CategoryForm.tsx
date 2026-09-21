"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createCategoryAction,
  updateCategoryAction,
} from "@/actions/categories";
import { useCreatePlusClose } from "@/components/CreatePlusModal";
import { Button, Field, FormMessage, Input, Select } from "@/components/ui";
import {
  CATEGORY_RECURRENCE_LABELS,
  groupsForCategoryType,
  type CategoryRecurrence,
  type CategoryType,
} from "@/lib/types";

type CategoryValues = {
  id: string;
  name: string;
  type: string;
  group: string;
  recurrence: string;
};

function CategoryFields({
  defaults,
}: {
  defaults?: Partial<CategoryValues>;
}) {
  const [type, setType] = useState<CategoryType>(
    (defaults?.type as CategoryType) ?? "expense",
  );
  const groupOptions = useMemo(() => groupsForCategoryType(type), [type]);
  const [group, setGroup] = useState(defaults?.group ?? groupOptions[0] ?? "");
  const [recurrence, setRecurrence] = useState<CategoryRecurrence>(
    defaults?.recurrence === "fijo" ? "fijo" : "eventual",
  );

  useEffect(() => {
    const options = [...groupsForCategoryType(type)] as string[];
    if (!options.includes(group)) {
      setGroup(options[0] ?? "");
    }
  }, [type, group]);

  return (
    <>
      <Field label="Nombre">
        <Input
          name="name"
          placeholder="Delivery, Psicóloga, Rescates FCI..."
          required
          defaultValue={defaults?.name ?? ""}
        />
      </Field>
      <Field label="Tipo">
        <Select
          name="type"
          value={type}
          onChange={(event) => setType(event.target.value as CategoryType)}
        >
          <option value="expense">Gasto</option>
          <option value="income">Ingreso</option>
          <option value="savings">Ahorro / inversión</option>
          <option value="neutral">Neutro</option>
        </Select>
      </Field>
      <Field label="Grupo">
        <Select
          name="group"
          value={group}
          onChange={(event) => setGroup(event.target.value)}
          required
        >
          {groupOptions.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Select>
      </Field>
      {type === "expense" ? (
        <Field label="Frecuencia">
          <Select
            name="recurrence"
            value={recurrence}
            onChange={(event) =>
              setRecurrence(event.target.value as CategoryRecurrence)
            }
          >
            <option value="eventual">{CATEGORY_RECURRENCE_LABELS.eventual}</option>
            <option value="fijo">{CATEGORY_RECURRENCE_LABELS.fijo}</option>
          </Select>
        </Field>
      ) : (
        <input type="hidden" name="recurrence" value="eventual" />
      )}
    </>
  );
}

export function CategoryForm() {
  const router = useRouter();
  const close = useCreatePlusClose();
  const [state, action, pending] = useActionState(createCategoryAction, null);

  useEffect(() => {
    if (state?.success) {
      close?.();
      router.refresh();
    }
  }, [state, close, router]);

  return (
    <form action={action} className="grid gap-4">
      <CategoryFields />
      <FormMessage state={state} />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Guardando..." : "Agregar concepto"}
      </Button>
    </form>
  );
}

export function EditCategoryForm({ category }: { category: CategoryValues }) {
  const router = useRouter();
  const close = useCreatePlusClose();
  const [state, action, pending] = useActionState(updateCategoryAction, null);

  useEffect(() => {
    if (state?.success) {
      close?.();
      router.refresh();
    }
  }, [state, close, router]);

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="id" value={category.id} />
      <CategoryFields defaults={category} />
      <FormMessage state={state} />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Guardando..." : "Guardar cambios"}
      </Button>
    </form>
  );
}
