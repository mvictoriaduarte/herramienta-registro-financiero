"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
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
});

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
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const amountArs = parseMoney(formData.get("amountArs"));
  const amountUsd = parseMoney(formData.get("amountUsd"));

  if (Number.isNaN(amountArs) || Number.isNaN(amountUsd)) {
    return { error: "Los montos no son válidos." };
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
    update: { amountArs, amountUsd },
    create: {
      year: parsed.data.year,
      month: parsed.data.month,
      kind: parsed.data.kind,
      amountArs,
      amountUsd,
      accountId: account.id,
      userId: session.userId,
    },
  });

  revalidatePath("/tenencias");
  revalidatePath("/dashboard");
  return { success: "Tenencia guardada." };
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
  revalidatePath("/tenencias");
  revalidatePath("/dashboard");
}
