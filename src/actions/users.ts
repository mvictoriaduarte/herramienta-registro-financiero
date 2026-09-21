"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hashPassword } from "@/lib/auth";
import { requireAdmin } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import type { ActionState } from "@/lib/types";

const createUserSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(3, "El usuario necesita al menos 3 caracteres.")
      .max(32, "El usuario es demasiado largo.")
      .regex(/^[a-zA-Z0-9._-]+$/, "Usá solo letras, números, punto, guion o guion bajo."),
    password: z.string().min(8, "La contraseña necesita al menos 8 caracteres."),
    confirmPassword: z.string().min(1, "Confirmá la contraseña."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden.",
    path: ["confirmPassword"],
  });

export async function createUserAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAdmin();

  const parsed = createUserSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const existing = await prisma.user.findUnique({
    where: { username: parsed.data.username },
  });

  if (existing) {
    return { error: "Ese usuario ya existe." };
  }

  await prisma.user.create({
    data: {
      username: parsed.data.username,
      passwordHash: await hashPassword(parsed.data.password),
      role: "user",
      createdById: session.userId,
    },
  });

  revalidatePath("/admin/usuarios");
  return { success: `Perfil “${parsed.data.username}” creado. No vas a poder ver sus registros.` };
}
