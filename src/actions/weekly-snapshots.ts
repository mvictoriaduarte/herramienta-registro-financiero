"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ensureBnaFxRate } from "@/lib/bna-fx";
import { convertHoldingAmount, mondayOnOrBefore, parseDateKey } from "@/lib/finance";
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

const snapshotSchema = z.object({
  accountId: z.string().min(1),
  weekDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  currency: z.enum(["ARS", "USD"]),
});

function isMonday(date: Date) {
  return date.getDay() === 1;
}

function isFutureMonday(date: Date) {
  const latest = mondayOnOrBefore();
  return date > latest;
}

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

function revalidateHoldings() {
  revalidatePath("/tenencias", "layout");
  revalidatePath("/dashboard");
}

export async function upsertWeeklySnapshotAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireUser();
  const parsed = snapshotSchema.safeParse({
    accountId: formData.get("accountId"),
    weekDate: formData.get("weekDate"),
    currency: formData.get("currency"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const week = parseDateKey(parsed.data.weekDate);
  if (!week || !isMonday(week)) {
    return { error: "La fecha tiene que ser un lunes." };
  }
  if (isFutureMonday(week)) {
    return { error: "Todavía no se puede cargar un lunes futuro." };
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

  await prisma.accountWeeklySnapshot.upsert({
    where: {
      userId_accountId_weekDate: {
        userId: session.userId,
        accountId: account.id,
        weekDate: parsed.data.weekDate,
      },
    },
    update: {
      currency: amounts.currency,
      amountArs: amounts.amountArs,
      amountUsd: amounts.amountUsd,
    },
    create: {
      weekDate: parsed.data.weekDate,
      currency: amounts.currency,
      amountArs: amounts.amountArs,
      amountUsd: amounts.amountUsd,
      accountId: account.id,
      userId: session.userId,
    },
  });

  revalidateHoldings();
  return { success: "Saldo del lunes guardado." };
}

export async function updateWeeklySnapshotAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireUser();
  const id = String(formData.get("id") ?? "");
  const parsed = snapshotSchema.safeParse({
    accountId: formData.get("accountId"),
    weekDate: formData.get("weekDate"),
    currency: formData.get("currency"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const week = parseDateKey(parsed.data.weekDate);
  if (!week || !isMonday(week)) {
    return { error: "La fecha tiene que ser un lunes." };
  }
  if (isFutureMonday(week)) {
    return { error: "Todavía no se puede cargar un lunes futuro." };
  }

  const amounts = await amountsFromForm(formData);
  if ("error" in amounts) {
    return { error: amounts.error };
  }

  const snapshot = await prisma.accountWeeklySnapshot.findFirst({
    where: { id, userId: session.userId },
  });

  if (!snapshot) {
    return { error: "Saldo semanal no encontrado." };
  }

  const account = await prisma.account.findFirst({
    where: { id: parsed.data.accountId, userId: session.userId },
  });

  if (!account) {
    return { error: "Cuenta no encontrada." };
  }

  const clash = await prisma.accountWeeklySnapshot.findFirst({
    where: {
      userId: session.userId,
      accountId: account.id,
      weekDate: parsed.data.weekDate,
      NOT: { id: snapshot.id },
    },
  });

  if (clash) {
    return { error: "Ya hay un saldo cargado para ese lunes." };
  }

  await prisma.accountWeeklySnapshot.update({
    where: { id: snapshot.id },
    data: {
      accountId: account.id,
      weekDate: parsed.data.weekDate,
      currency: amounts.currency,
      amountArs: amounts.amountArs,
      amountUsd: amounts.amountUsd,
    },
  });

  revalidateHoldings();
  return { success: "Saldo del lunes actualizado." };
}

export async function deleteWeeklySnapshotAction(formData: FormData) {
  const session = await requireUser();
  const id = String(formData.get("id") ?? "");

  const snapshot = await prisma.accountWeeklySnapshot.findFirst({
    where: { id, userId: session.userId },
  });

  if (!snapshot) {
    return;
  }

  await prisma.accountWeeklySnapshot.delete({ where: { id: snapshot.id } });
  revalidateHoldings();
}
