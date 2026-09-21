"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ensureBnaFxRate } from "@/lib/bna-fx";
import { convertHoldingAmount } from "@/lib/finance";
import { parseAmount } from "@/lib/format";
import { requireUser } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import type { ActionState } from "@/lib/types";

function parseMoney(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return 0;
  }
  const amount = parseAmount(raw);
  if (!Number.isFinite(amount) || amount < 0) {
    return NaN;
  }
  return Math.round(amount * 100) / 100;
}

const balanceSchema = z.object({
  accountId: z.string().min(1),
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  kind: z.enum(["start", "end"]),
  currency: z.enum(["ARS", "USD"]),
});

async function amountsFromForm(formData: FormData) {
  const currency = String(formData.get("currency") ?? "ARS") === "USD" ? "USD" : "ARS";
  const amount = parseMoney(formData.get("amount"));
  if (Number.isNaN(amount)) {
    return { error: "El monto no es válido." as const };
  }
  if (amount === 0) {
    return { currency, amountArs: 0, amountUsd: 0 };
  }

  const fx = await ensureBnaFxRate();
  const converted = convertHoldingAmount(amount, currency, fx);
  if (!converted) {
    return { error: "No hay tipo de cambio BNA disponible." as const };
  }
  return { currency, ...converted };
}

export async function upsertAccountBalanceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireUser();
  const parsed = balanceSchema.safeParse({
    accountId: formData.get("accountId"),
    year: formData.get("year"),
    month: formData.get("month"),
    kind: formData.get("kind"),
    currency: formData.get("currency"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const amounts = await amountsFromForm(formData);
  if ("error" in amounts) {
    return { error: amounts.error };
  }

  const account = await prisma.account.findFirst({
    where: { id: parsed.data.accountId, userId: session.userId },
  });

  if (!account) {
    return { error: "Cuenta no encontrada." };
  }

  await prisma.accountBalance.upsert({
    where: {
      userId_accountId_year_month_kind: {
        userId: session.userId,
        accountId: account.id,
        year: parsed.data.year,
        month: parsed.data.month,
        kind: parsed.data.kind,
      },
    },
    update: {
      currency: amounts.currency,
      amountArs: amounts.amountArs,
      amountUsd: amounts.amountUsd,
    },
    create: {
      year: parsed.data.year,
      month: parsed.data.month,
      kind: parsed.data.kind,
      currency: amounts.currency,
      amountArs: amounts.amountArs,
      amountUsd: amounts.amountUsd,
      accountId: account.id,
      userId: session.userId,
    },
  });

  revalidatePath("/tenencias", "layout");
  revalidatePath("/dashboard");
  return { success: "Tenencia guardada." };
}

export async function updateAccountBalanceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireUser();
  const id = String(formData.get("id") ?? "");
  const parsed = balanceSchema.safeParse({
    accountId: formData.get("accountId"),
    year: formData.get("year"),
    month: formData.get("month"),
    kind: formData.get("kind"),
    currency: formData.get("currency"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const amounts = await amountsFromForm(formData);
  if ("error" in amounts) {
    return { error: amounts.error };
  }

  const balance = await prisma.accountBalance.findFirst({
    where: { id, userId: session.userId },
  });

  if (!balance) {
    return { error: "Tenencia no encontrada." };
  }

  const account = await prisma.account.findFirst({
    where: { id: parsed.data.accountId, userId: session.userId },
  });

  if (!account) {
    return { error: "Cuenta no encontrada." };
  }

  const clash = await prisma.accountBalance.findFirst({
    where: {
      userId: session.userId,
      accountId: account.id,
      year: parsed.data.year,
      month: parsed.data.month,
      kind: parsed.data.kind,
      NOT: { id: balance.id },
    },
  });

  if (clash) {
    return { error: "Ya hay una tenencia para esa cuenta, mes y momento." };
  }

  await prisma.accountBalance.update({
    where: { id: balance.id },
    data: {
      accountId: account.id,
      year: parsed.data.year,
      month: parsed.data.month,
      kind: parsed.data.kind,
      currency: amounts.currency,
      amountArs: amounts.amountArs,
      amountUsd: amounts.amountUsd,
    },
  });

  revalidatePath("/tenencias", "layout");
  revalidatePath("/dashboard");
  return { success: "Tenencia actualizada." };
}

export async function deleteAccountBalanceAction(formData: FormData) {
  const session = await requireUser();
  const id = String(formData.get("id") ?? "");

  const balance = await prisma.accountBalance.findFirst({
    where: { id, userId: session.userId },
  });

  if (!balance) {
    return;
  }

  await prisma.accountBalance.delete({ where: { id: balance.id } });
  revalidatePath("/tenencias", "layout");
  revalidatePath("/dashboard");
}
