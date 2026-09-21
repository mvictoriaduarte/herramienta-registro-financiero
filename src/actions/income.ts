"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { computeIncomeBase, nextSourceColor } from "@/lib/finance";
import { parseAmount } from "@/lib/format";
import { requireUser } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import type { ActionState, BillingMode } from "@/lib/types";
import { deleteSourceLogoFile, saveSourceLogo } from "@/lib/uploads";

const hexColor = z
  .string()
  .trim()
  .regex(/^#([0-9A-Fa-f]{6})$/, "Usá un color HEX válido, por ejemplo #0E4A5A.");

const sourceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "El nombre necesita al menos 2 caracteres.")
    .max(60, "El nombre es demasiado largo."),
  billingMode: z.enum(["hourly", "weekly", "biweekly", "monthly", "project"]),
  color: hexColor.optional(),
  defaultFxRate: z.string().optional(),
});

function parseFxRate(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return null;
  }
  const amount = parseAmount(raw);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NaN;
  }
  return Math.round(amount * 10000) / 10000;
}

function revalidateIncome(sourceId?: string) {
  revalidatePath("/ingresos");
  revalidatePath("/dashboard");
  if (sourceId) {
    revalidatePath(`/ingresos/${sourceId}`);
  }
}

function getLogoFile(formData: FormData) {
  const value = formData.get("logo");
  return value instanceof File ? value : null;
}

export async function createIncomeSourceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireUser();
  const parsed = sourceSchema.safeParse({
    name: formData.get("name"),
    billingMode: formData.get("billingMode"),
    color: formData.get("color") || undefined,
    defaultFxRate: formData.get("defaultFxRate") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const existing = await prisma.incomeSource.findFirst({
    where: { userId: session.userId, name: parsed.data.name },
  });

  if (existing) {
    return { error: "Ya tenés una fuente con ese nombre." };
  }

  const fxRate = parseFxRate(parsed.data.defaultFxRate ?? null);
  if (Number.isNaN(fxRate)) {
    return { error: "El tipo de cambio no es válido." };
  }

  const used = await prisma.incomeSource.findMany({
    where: { userId: session.userId },
    select: { color: true },
  });

  const source = await prisma.incomeSource.create({
    data: {
      name: parsed.data.name,
      billingMode: parsed.data.billingMode,
      color: parsed.data.color ?? nextSourceColor(used.map((item) => item.color)),
      defaultFxRate: fxRate,
      userId: session.userId,
    },
  });

  const logoResult = await saveSourceLogo(getLogoFile(formData), source.id);
  if (logoResult && "error" in logoResult) {
    return { error: logoResult.error };
  }
  if (logoResult && "url" in logoResult) {
    await prisma.incomeSource.update({
      where: { id: source.id },
      data: { logoUrl: logoResult.url },
    });
  }

  revalidateIncome(source.id);
  return { success: "Fuente de ingresos creada." };
}

export async function updateIncomeSourceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireUser();
  const id = String(formData.get("id") ?? "");
  const parsed = sourceSchema.safeParse({
    name: formData.get("name"),
    billingMode: formData.get("billingMode"),
    color: formData.get("color"),
    defaultFxRate: formData.get("defaultFxRate") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const source = await prisma.incomeSource.findFirst({
    where: { id, userId: session.userId },
  });

  if (!source) {
    return { error: "Fuente no encontrada." };
  }

  const duplicate = await prisma.incomeSource.findFirst({
    where: {
      userId: session.userId,
      name: parsed.data.name,
      NOT: { id: source.id },
    },
  });

  if (duplicate) {
    return { error: "Ya tenés otra fuente con ese nombre." };
  }

  const fxRate = parseFxRate(parsed.data.defaultFxRate ?? null);
  if (Number.isNaN(fxRate)) {
    return { error: "El tipo de cambio no es válido." };
  }

  const removeLogo = formData.get("removeLogo") === "on";
  const logoResult = await saveSourceLogo(getLogoFile(formData), source.id);
  if (logoResult && "error" in logoResult) {
    return { error: logoResult.error };
  }

  let nextLogoUrl = source.logoUrl;
  if (logoResult && "url" in logoResult) {
    await deleteSourceLogoFile(source.logoUrl);
    nextLogoUrl = logoResult.url;
  } else if (removeLogo) {
    await deleteSourceLogoFile(source.logoUrl);
    nextLogoUrl = null;
  }

  await prisma.incomeSource.update({
    where: { id: source.id },
    data: {
      name: parsed.data.name,
      billingMode: parsed.data.billingMode,
      color: parsed.data.color ?? source.color,
      defaultFxRate: fxRate,
      logoUrl: nextLogoUrl,
    },
  });

  revalidateIncome(source.id);
  return { success: "Fuente actualizada." };
}

export async function deleteIncomeSourceAction(formData: FormData) {
  const session = await requireUser();
  const id = String(formData.get("id") ?? "");

  const source = await prisma.incomeSource.findFirst({
    where: { id, userId: session.userId },
  });

  if (!source) {
    return;
  }

  await deleteSourceLogoFile(source.logoUrl);
  await prisma.incomeSource.delete({ where: { id: source.id } });
  revalidateIncome();
}

function parseOptionalAmount(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return null;
  }
  const amount = parseAmount(raw);
  if (!Number.isFinite(amount) || amount < 0) {
    return NaN;
  }
  return Math.round(amount * 100) / 100;
}

const periodSchema = z.object({
  sourceId: z.string().min(1),
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

export async function upsertIncomePeriodAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireUser();
  const parsed = periodSchema.safeParse({
    sourceId: formData.get("sourceId"),
    year: formData.get("year"),
    month: formData.get("month"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const source = await prisma.incomeSource.findFirst({
    where: { id: parsed.data.sourceId, userId: session.userId },
  });

  if (!source) {
    return { error: "Fuente no encontrada." };
  }

  const billingMode = source.billingMode as BillingMode;
  let units: number | null = null;
  let unitValue: number | null = null;
  let fixedAmount: number | null = null;

  if (billingMode === "monthly") {
    fixedAmount = parseOptionalAmount(formData.get("fixedAmount"));
    if (fixedAmount === null || Number.isNaN(fixedAmount)) {
      return { error: "Ingresá el monto mensual." };
    }
  } else {
    units = parseOptionalAmount(formData.get("units"));
    unitValue = parseOptionalAmount(formData.get("unitValue"));
    if (units === null || Number.isNaN(units) || unitValue === null || Number.isNaN(unitValue)) {
      return { error: "Ingresá cantidad y valor unitario." };
    }
  }

  const base = computeIncomeBase(billingMode, { units, unitValue, fixedAmount });
  if (base < 0) {
    return { error: "El monto base no puede ser negativo." };
  }

  await prisma.incomePeriod.upsert({
    where: {
      userId_sourceId_year_month: {
        userId: session.userId,
        sourceId: source.id,
        year: parsed.data.year,
        month: parsed.data.month,
      },
    },
    update: { units, unitValue, fixedAmount },
    create: {
      year: parsed.data.year,
      month: parsed.data.month,
      units,
      unitValue,
      fixedAmount,
      sourceId: source.id,
      userId: session.userId,
    },
  });

  revalidateIncome(source.id);
  return { success: "Período guardado." };
}

export async function addIncomeAdjustmentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireUser();
  const periodId = String(formData.get("periodId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const rawAmount = parseAmount(String(formData.get("amount") ?? ""));

  if (!name || name.length < 2) {
    return { error: "Nombrá el adicional." };
  }
  if (!Number.isFinite(rawAmount)) {
    return { error: "Ingresá un monto válido (puede ser negativo)." };
  }

  const period = await prisma.incomePeriod.findFirst({
    where: { id: periodId, userId: session.userId },
  });

  if (!period) {
    return { error: "Período no encontrado." };
  }

  await prisma.incomeAdjustment.create({
    data: {
      name,
      amount: Math.round(rawAmount * 100) / 100,
      periodId: period.id,
    },
  });

  revalidateIncome(period.sourceId);
  return { success: "Adicional agregado." };
}

export async function deleteIncomeAdjustmentAction(formData: FormData) {
  const session = await requireUser();
  const id = String(formData.get("id") ?? "");

  const adjustment = await prisma.incomeAdjustment.findFirst({
    where: { id },
    include: { period: true },
  });

  if (!adjustment || adjustment.period.userId !== session.userId) {
    return;
  }

  await prisma.incomeAdjustment.delete({ where: { id: adjustment.id } });
  revalidateIncome(adjustment.period.sourceId);
}

export async function deleteIncomePeriodAction(formData: FormData) {
  const session = await requireUser();
  const id = String(formData.get("id") ?? "");

  const period = await prisma.incomePeriod.findFirst({
    where: { id, userId: session.userId },
  });

  if (!period) {
    return;
  }

  await prisma.incomePeriod.delete({ where: { id: period.id } });
  revalidateIncome(period.sourceId);
}
