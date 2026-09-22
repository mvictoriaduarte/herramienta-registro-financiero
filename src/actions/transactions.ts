"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ensureBnaFxRate } from "@/lib/bna-fx";
import { parseTransferKind, resolvedBank } from "@/lib/finance";
import { parseAmount } from "@/lib/format";
import { requireUser } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import type { ActionState } from "@/lib/types";

const TRANSFER_CATEGORY_NAME = "Inversión / rescate";

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

const transferSchema = z
  .object({
    amount: amountField("Monto"),
    transferKind: z.enum(["investment", "redemption"], {
      message: "Elegí si es inversión o rescate.",
    }),
    operatingAccountId: z.string().min(1, "Elegí la caja operativa."),
    instrumentAccountId: z.string().min(1, "Elegí el instrumento."),
    date: z.string().min(1, "Elegí una fecha."),
    note: z.string().trim().max(200, "La descripción es demasiado larga.").optional(),
  })
  .superRefine((data, ctx) => {
    if (data.amount <= 0) {
      ctx.addIssue({
        code: "custom",
        message: "Ingresá un monto mayor a cero.",
      });
    }
    if (data.operatingAccountId === data.instrumentAccountId) {
      ctx.addIssue({
        code: "custom",
        message: "La caja y el instrumento tienen que ser cuentas distintas.",
      });
    }
  });

function parseTransferForm(formData: FormData) {
  return transferSchema.safeParse({
    amount: formData.get("amount") ?? "",
    transferKind: formData.get("transferKind") ?? "",
    operatingAccountId: formData.get("operatingAccountId"),
    instrumentAccountId: formData.get("instrumentAccountId"),
    date: formData.get("date"),
    note: formData.get("note") ?? "",
  });
}

function revalidateFinance() {
  revalidatePath("/movimientos");
  revalidatePath("/dashboard");
  revalidatePath("/tenencias", "layout");
}

async function ensureTransferCategory(userId: string) {
  const existing = await prisma.category.findFirst({
    where: { userId, name: TRANSFER_CATEGORY_NAME, type: "savings" },
  });
  if (existing) {
    return existing;
  }
  return prisma.category.create({
    data: {
      name: TRANSFER_CATEGORY_NAME,
      type: "savings",
      group: "Ahorro/Inversión",
      recurrence: "eventual",
      userId,
    },
  });
}

async function loadTransferAccounts(
  userId: string,
  operatingAccountId: string,
  instrumentAccountId: string,
) {
  const [operating, instrument] = await Promise.all([
    prisma.account.findFirst({
      where: { id: operatingAccountId, userId, active: true },
    }),
    prisma.account.findFirst({
      where: { id: instrumentAccountId, userId, active: true },
    }),
  ]);
  if (!operating || !instrument) {
    return { error: "Esa cuenta no existe o está inactiva." as const };
  }
  const operatingBank = resolvedBank(operating);
  const instrumentBank = resolvedBank(instrument);
  if (
    operatingBank.bankRole !== "operating" ||
    instrumentBank.bankRole !== "instrument" ||
    !operatingBank.bankName ||
    operatingBank.bankName !== instrumentBank.bankName
  ) {
    return {
      error:
        "La inversión y el rescate van entre la caja y un instrumento del mismo banco." as const,
    };
  }
  return { operating, instrument, bankName: operatingBank.bankName };
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
  if (String(formData.get("entryKind") ?? "cash") === "transfer") {
    return createBankTransfer(session.userId, formData);
  }
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

  revalidateFinance();
  return { success: "Movimiento guardado." };
}

async function createBankTransfer(userId: string, formData: FormData): Promise<ActionState> {
  const parsed = parseTransferForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const accounts = await loadTransferAccounts(
    userId,
    parsed.data.operatingAccountId,
    parsed.data.instrumentAccountId,
  );
  if ("error" in accounts) {
    return { error: accounts.error };
  }

  const date = new Date(`${parsed.data.date}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    return { error: "La fecha no es válida." };
  }

  const category = await ensureTransferCategory(userId);
  const groupId = crypto.randomUUID();
  const kind = parsed.data.transferKind;
  const note = parsed.data.note ?? "";
  const amount = parsed.data.amount;
  const debitId =
    kind === "investment" ? accounts.operating.id : accounts.instrument.id;
  const creditId =
    kind === "investment" ? accounts.instrument.id : accounts.operating.id;
  const label = kind === "investment" ? "Inversión" : "Rescate";

  await prisma.$transaction([
    prisma.transaction.create({
      data: {
        incomeAmount: 0,
        expenseAmount: amount,
        amount,
        date,
        note: note || `${label} ${accounts.bankName}`,
        currency: "ARS",
        fxRate: null,
        transferGroupId: groupId,
        transferKind: kind,
        categoryId: category.id,
        accountId: debitId,
        userId,
      },
    }),
    prisma.transaction.create({
      data: {
        incomeAmount: amount,
        expenseAmount: 0,
        amount,
        date,
        note: note || `${label} ${accounts.bankName}`,
        currency: "ARS",
        fxRate: null,
        transferGroupId: groupId,
        transferKind: kind,
        categoryId: category.id,
        accountId: creditId,
        userId,
      },
    }),
  ]);

  revalidateFinance();
  return {
    success:
      kind === "investment" ? "Inversión registrada." : "Rescate registrado.",
  };
}

async function updateBankTransfer(
  userId: string,
  current: { id: string; transferGroupId: string; refunds: { amount: number }[] },
  formData: FormData,
): Promise<ActionState> {
  if (current.refunds.length > 0) {
    return { error: "No se puede editar una inversión/rescate con devoluciones." };
  }

  const parsed = parseTransferForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const accounts = await loadTransferAccounts(
    userId,
    parsed.data.operatingAccountId,
    parsed.data.instrumentAccountId,
  );
  if ("error" in accounts) {
    return { error: accounts.error };
  }

  const date = new Date(`${parsed.data.date}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    return { error: "La fecha no es válida." };
  }

  const groupId = current.transferGroupId;
  if (!groupId) {
    return { error: "No se encontró el movimiento vinculado." };
  }

  const legs = await prisma.transaction.findMany({
    where: { userId, transferGroupId: groupId },
    include: { refunds: true },
  });
  if (legs.some((item) => item.refunds.length > 0)) {
    return { error: "No se puede editar una inversión/rescate con devoluciones." };
  }

  const category = await ensureTransferCategory(userId);
  const kind = parsed.data.transferKind;
  const note = parsed.data.note ?? "";
  const amount = parsed.data.amount;
  const debitId =
    kind === "investment" ? accounts.operating.id : accounts.instrument.id;
  const creditId =
    kind === "investment" ? accounts.instrument.id : accounts.operating.id;
  const label = kind === "investment" ? "Inversión" : "Rescate";
  const debit = legs.find((item) => item.expenseAmount > 0) ?? legs[0];
  const credit = legs.find((item) => item.id !== debit?.id) ?? null;

  if (!debit) {
    return { error: "No se encontró el movimiento vinculado." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.transaction.update({
      where: { id: debit.id },
      data: {
        incomeAmount: 0,
        expenseAmount: amount,
        amount,
        date,
        note: note || `${label} ${accounts.bankName}`,
        currency: "ARS",
        fxRate: null,
        transferKind: kind,
        categoryId: category.id,
        accountId: debitId,
      },
    });
    if (credit) {
      await tx.transaction.update({
        where: { id: credit.id },
        data: {
          incomeAmount: amount,
          expenseAmount: 0,
          amount,
          date,
          note: note || `${label} ${accounts.bankName}`,
          currency: "ARS",
          fxRate: null,
          transferKind: kind,
          categoryId: category.id,
          accountId: creditId,
        },
      });
    } else {
      await tx.transaction.create({
        data: {
          incomeAmount: amount,
          expenseAmount: 0,
          amount,
          date,
          note: note || `${label} ${accounts.bankName}`,
          currency: "ARS",
          fxRate: null,
          transferGroupId: groupId,
          transferKind: kind,
          categoryId: category.id,
          accountId: creditId,
          userId,
        },
      });
    }
  });

  revalidateFinance();
  return { success: "Movimiento actualizado." };
}

export async function updateTransactionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireUser();
  const id = String(formData.get("id") ?? "");
  const existing = await prisma.transaction.findFirst({
    where: { id, userId: session.userId },
    include: { refunds: true },
  });

  if (!existing) {
    return { error: "Movimiento no encontrado." };
  }

  if (
    String(formData.get("entryKind") ?? "") === "transfer" ||
    parseTransferKind(existing.transferKind) !== "normal"
  ) {
    return updateBankTransfer(session.userId, existing, formData);
  }

  const parsed = parseTransactionForm(formData);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const transaction = existing;

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

  revalidateFinance();
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

  if (transaction.transferGroupId) {
    await prisma.transaction.deleteMany({
      where: {
        userId: session.userId,
        transferGroupId: transaction.transferGroupId,
      },
    });
  } else {
    await prisma.transaction.delete({
      where: { id: transaction.id },
    });
  }

  revalidateFinance();
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

  revalidateFinance();
  return { success: "Devolución registrada." };
}

export async function updateTransactionRefundAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireUser();
  const refundId = String(formData.get("refundId") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  const amount = parseAmount(String(formData.get("amount") ?? ""));
  const dateRaw = String(formData.get("date") ?? "").trim();

  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Ingresá un monto de devolución mayor a cero." };
  }

  const refund = await prisma.transactionRefund.findFirst({
    where: { id: refundId },
    include: {
      transaction: {
        include: { refunds: true },
      },
    },
  });

  if (!refund || refund.transaction.userId !== session.userId) {
    return { error: "Devolución no encontrada." };
  }

  const transaction = refund.transaction;
  if (transaction.expenseAmount <= 0) {
    return { error: "Solo se pueden editar devoluciones de gastos." };
  }

  const otherRefunded = transaction.refunds
    .filter((item) => item.id !== refund.id)
    .reduce((sum, item) => sum + item.amount, 0);
  const maxAllowed = Math.round((transaction.expenseAmount - otherRefunded) * 100) / 100;
  if (amount > maxAllowed + 0.001) {
    return {
      error: `La devolución no puede superar el saldo disponible (${maxAllowed.toLocaleString("es-AR")}).`,
    };
  }

  let date: Date | null = null;
  if (dateRaw) {
    date = new Date(`${dateRaw}T12:00:00`);
    if (Number.isNaN(date.getTime())) {
      return { error: "La fecha de devolución no es válida." };
    }
  }

  await prisma.transactionRefund.update({
    where: { id: refund.id },
    data: {
      amount: Math.round(amount * 100) / 100,
      note,
      date,
    },
  });

  revalidateFinance();
  return { success: "Devolución actualizada." };
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

  revalidateFinance();
}
