"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import type { ActionState, CategoryType } from "@/lib/types";
import { groupsForCategoryType } from "@/lib/types";

const categorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "El nombre necesita al menos 2 caracteres.")
    .max(60, "El nombre es demasiado largo."),
  type: z.enum(["income", "expense", "savings", "neutral"]),
  group: z.string().trim().max(60).optional(),
  recurrence: z.enum(["fijo", "eventual"]).optional(),
});

function revalidateCategories() {
  revalidatePath("/categorias");
  revalidatePath("/movimientos");
  revalidatePath("/dashboard");
}

function normalizeGroup(type: CategoryType, group: string | undefined) {
  const trimmed = group?.trim() ?? "";
  if (!trimmed) {
    const defaults = groupsForCategoryType(type);
    return defaults[0] ?? "";
  }
  return trimmed;
}

function normalizeRecurrence(type: CategoryType, recurrence: string | undefined) {
  if (type !== "expense") {
    return "eventual";
  }
  return recurrence === "fijo" ? "fijo" : "eventual";
}

export async function createCategoryAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireUser();
  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    group: formData.get("group") ?? "",
    recurrence: formData.get("recurrence") ?? "eventual",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const existing = await prisma.category.findFirst({
    where: {
      userId: session.userId,
      name: parsed.data.name,
      type: parsed.data.type,
    },
  });

  if (existing) {
    return { error: "Ya tenés una categoría con ese nombre y tipo." };
  }

  await prisma.category.create({
    data: {
      name: parsed.data.name,
      type: parsed.data.type,
      group: normalizeGroup(parsed.data.type, parsed.data.group),
      recurrence: normalizeRecurrence(parsed.data.type, parsed.data.recurrence),
      userId: session.userId,
    },
  });

  revalidateCategories();
  return { success: "Categoría creada." };
}

export async function updateCategoryAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireUser();
  const id = String(formData.get("id") ?? "");
  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    group: formData.get("group") ?? "",
    recurrence: formData.get("recurrence") ?? "eventual",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const category = await prisma.category.findFirst({
    where: { id, userId: session.userId },
  });

  if (!category) {
    return { error: "Concepto no encontrado." };
  }

  const clash = await prisma.category.findFirst({
    where: {
      userId: session.userId,
      name: parsed.data.name,
      type: parsed.data.type,
      NOT: { id: category.id },
    },
  });

  if (clash) {
    return { error: "Ya tenés una categoría con ese nombre y tipo." };
  }

  await prisma.category.update({
    where: { id: category.id },
    data: {
      name: parsed.data.name,
      type: parsed.data.type,
      group: normalizeGroup(parsed.data.type, parsed.data.group),
      recurrence: normalizeRecurrence(parsed.data.type, parsed.data.recurrence),
    },
  });

  revalidateCategories();
  return { success: "Concepto actualizado." };
}

export async function deleteCategoryAction(formData: FormData) {
  const session = await requireUser();
  const id = String(formData.get("id") ?? "");

  const category = await prisma.category.findFirst({
    where: { id, userId: session.userId },
    include: { _count: { select: { transactions: true } } },
  });

  if (!category) {
    return { error: "Concepto no encontrado." };
  }

  if (category._count.transactions > 0) {
    return {
      error: `No se puede eliminar: tiene ${category._count.transactions} movimiento${
        category._count.transactions === 1 ? "" : "s"
      } asociado${category._count.transactions === 1 ? "" : "s"}.`,
    };
  }

  await prisma.category.delete({
    where: { id: category.id },
  });

  revalidateCategories();
  return { success: "Concepto eliminado." };
}
