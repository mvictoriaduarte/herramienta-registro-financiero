"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ensureBnaFxRate } from "@/lib/bna-fx";
import { parseAmount } from "@/lib/format";
import { requireUser } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import type { ActionState } from "@/lib/types";

function amountField(label: string) {
  return z.string().transform((value, ctx) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return 0;
    }
    const amount = parseAmount(trimmed);
    if (!Number.isFinite(amount) || amount < 0) {
      ctx.addIssue({
        code: "custom",
        message: `${label} inválido.`,
      });
      return z.NEVER;
    }
    return Math.round(amount * 100) / 100;
  });
}

const transactionSchema = z
  .object({
    amount: amountField("Monto"),
    direction: z.enum(["income", "expense"], {
      message: "Elegí si el monto es ingreso o gasto.",
    }),
    date: z.string().min(1, "Elegí una fecha."),
    categoryId: z.string().min(1, "Elegí un concepto."),
    accountId: z.string().min(1, "Elegí un origen/destino."),
    currency: z.enum(["ARS", "USD"]),
    note: z.string().trim().max(200, "La descripción es demasiado larga.").optional(),
  })
  .superRefine((data, ctx) => {
    if (data.amount <= 0) {
      ctx.addIssue({
        code: "custom",
        message: "Ingresá un monto mayor a cero.",
      });
    }
  });

function amountsFromDirection(direction: "income" | "expense", amount: number) {
  return {
    incomeAmount: direction === "income" ? amount : 0,
    expenseAmount: direction === "expense" ? amount : 0,
  };
}

function parseTransactionForm(formData: FormData) {
  return transactionSchema.safeParse({
    amount: formData.get("amount") ?? "",
    direction: formData.get("direction") ?? "",
    date: formData.get("date"),
    categoryId: formData.get("categoryId"),
    accountId: formData.get("accountId"),
    currency: formData.get("currency") ?? "ARS",
    note: formData.get("note") ?? "",
  });
}

async function resolveFxRate(currency: "ARS" | "USD") {
  if (currency !== "USD") {
    return null;
  }
  const bna = await ensureBnaFxRate();
  return bna?.sell ?? null;
}

export async function createTransactionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireUser();
  const parsed = parseTransactionForm(formData);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const [category, account] = await Promise.all([
    prisma.category.findFirst({
      where: { id: parsed.data.categoryId, userId: session.userId },
    }),
    prisma.account.findFirst({
      where: { id: parsed.data.accountId, userId: session.userId, active: true },
    }),
  ]);

  if (!category) {
    return { error: "Ese concepto no existe en tu perfil." };
  }
  if (!account) {
    return { error: "Esa cuenta no existe o está inactiva." };
  }

  const date = new Date(`${parsed.data.date}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    return { error: "La fecha no es válida." };
  }

  const fxRate = await resolveFxRate(parsed.data.currency);
  const { incomeAmount, expenseAmount } = amountsFromDirection(
    parsed.data.direction,
    parsed.data.amount,
  );

  await prisma.transaction.create({
    data: {
      incomeAmount,
      expenseAmount,
      amount: parsed.data.amount,
      date,
      note: parsed.data.note ?? "",
      currency: parsed.data.currency,
      fxRate,
      categoryId: category.id,
      accountId: account.id,
      userId: session.userId,
    },
  });

  revalidatePath("/movimientos");
  revalidatePath("/dashboard");
  revalidatePath("/tenencias");
  return { success: "Movimiento guardado." };
}

export async function updateTransactionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireUser();
  const id = String(formData.get("id") ?? "");
  const parsed = parseTransactionForm(formData);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const transaction = await prisma.transaction.findFirst({
    where: { id, userId: session.userId },
    include: { refunds: true },
  });

  if (!transaction) {
    return { error: "Movimiento no encontrado." };
  }

  const [category, account] = await Promise.all([
    prisma.category.findFirst({
      where: { id: parsed.data.categoryId, userId: session.userId },
    }),
    prisma.account.findFirst({
      where: { id: parsed.data.accountId, userId: session.userId },
    }),
  ]);

  if (!category) {
    return { error: "Ese concepto no existe en tu perfil." };
  }
  if (!account) {
    return { error: "Esa cuenta no existe." };
  }

  const date = new Date(`${parsed.data.date}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    return { error: "La fecha no es válida." };
  }

  const fxRate = await resolveFxRate(parsed.data.currency);
  const { incomeAmount, expenseAmount } = amountsFromDirection(
    parsed.data.direction,
    parsed.data.amount,
  );

  const refunded = transaction.refunds.reduce((sum, item) => sum + item.amount, 0);
  if (expenseAmount > 0 && expenseAmount + 0.001 < refunded) {
    return {
      error: `El gasto no puede ser menor a las devoluciones ya cargadas (${refunded.toLocaleString("es-AR")}).`,
    };
  }
  if (incomeAmount > 0 && refunded > 0) {
    return { error: "No podés convertir en ingreso un gasto que ya tiene devoluciones." };
  }

  await prisma.transaction.update({
    where: { id: transaction.id },
    data: {
      incomeAmount,
      expenseAmount,
      amount: parsed.data.amount,
      date,
      note: parsed.data.note ?? "",
      currency: parsed.data.currency,
      fxRate,
      categoryId: category.id,
      accountId: account.id,
    },
  });

  revalidatePath("/movimientos");
  revalidatePath("/dashboard");
  revalidatePath("/tenencias");
  return { success: "Movimiento actualizado." };
}

export async function deleteTransactionAction(formData: FormData) {
  const session = await requireUser();
  const id = String(formData.get("id") ?? "");

  const transaction = await prisma.transaction.findFirst({
    where: { id, userId: session.userId },
  });

  if (!transaction) {
    return;
  }

  await prisma.transaction.delete({
    where: { id: transaction.id },
  });

  revalidatePath("/movimientos");
  revalidatePath("/dashboard");
  revalidatePath("/tenencias");
}

export async function addTransactionRefundAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireUser();
  const transactionId = String(formData.get("transactionId") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  const amount = parseAmount(String(formData.get("amount") ?? ""));
  const dateRaw = String(formData.get("date") ?? "").trim();

  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Ingresá un monto de devolución mayor a cero." };
  }

  const transaction = await prisma.transaction.findFirst({
    where: { id: transactionId, userId: session.userId },
    include: { refunds: true },
  });

  if (!transaction) {
    return { error: "Movimiento no encontrado." };
  }
  if (transaction.expenseAmount <= 0) {
    return { error: "Solo se pueden cargar devoluciones sobre gastos." };
  }

  const alreadyRefunded = transaction.refunds.reduce((sum, item) => sum + item.amount, 0);
  const remaining = Math.round((transaction.expenseAmount - alreadyRefunded) * 100) / 100;
  if (amount > remaining + 0.001) {
    return {
      error: `La devolución no puede superar el saldo pendiente (${remaining.toLocaleString("es-AR")}).`,
    };
  }

  let date: Date | null = null;
  if (dateRaw) {
    date = new Date(`${dateRaw}T12:00:00`);
    if (Number.isNaN(date.getTime())) {
      return { error: "La fecha de devolución no es válida." };
    }
  }

  await prisma.transactionRefund.create({
    data: {
      amount: Math.round(amount * 100) / 100,
      note,
      date,
      transactionId: transaction.id,
    },
  });

  revalidatePath("/movimientos");
  revalidatePath("/dashboard");
  revalidatePath("/tenencias");
  return { success: "Devolución registrada." };
}

export async function deleteTransactionRefundAction(formData: FormData) {
  const session = await requireUser();
  const id = String(formData.get("id") ?? "");

  const refund = await prisma.transactionRefund.findFirst({
    where: { id },
    include: { transaction: true },
  });

  if (!refund || refund.transaction.userId !== session.userId) {
    return;
  }

  await prisma.transactionRefund.delete({ where: { id: refund.id } });

  revalidatePath("/movimientos");
  revalidatePath("/dashboard");
  revalidatePath("/tenencias");
}
