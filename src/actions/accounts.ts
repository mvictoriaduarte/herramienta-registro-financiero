"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import type { ActionState } from "@/lib/types";
import { parseAccountPurpose, parseBankRole } from "@/lib/finance";

const accountSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "El nombre necesita al menos 2 caracteres.")
    .max(60, "El nombre es demasiado largo."),
  currency: z.enum(["ARS", "USD"]),
  purpose: z.enum(["spending", "savings"]),
  tracksYield: z.boolean().optional(),
  bankName: z.string().trim().max(40, "El banco es demasiado largo.").optional(),
  bankRole: z.enum(["none", "operating", "instrument"]).optional(),
  isDefault: z.boolean().optional(),
});

function revalidateAccounts() {
  revalidatePath("/cuentas");
  revalidatePath("/movimientos");
  revalidatePath("/tenencias");
  revalidatePath("/dashboard");
}

async function applyDefaultFlag(userId: string, accountId: string, makeDefault: boolean) {
  if (makeDefault) {
    await prisma.account.updateMany({
      where: { userId, isDefault: true, NOT: { id: accountId } },
      data: { isDefault: false },
    });
    return true;
  }

  const current = await prisma.account.findFirst({
    where: { id: accountId, userId },
  });
  if (current?.isDefault) {
    const next = await prisma.account.findFirst({
      where: { userId, NOT: { id: accountId } },
      orderBy: { createdAt: "asc" },
    });
    if (next) {
      await prisma.account.update({
        where: { id: next.id },
        data: { isDefault: true },
      });
    }
  }
  return false;
}

function bankFieldsFromForm(formData: FormData) {
  const banking = formData.get("banking") === "on";
  const bankName = String(formData.get("bankName") ?? "").trim();
  const bankRole = parseBankRole(formData.get("bankRole"));
  if (!banking) {
    return { bankName: "", bankRole: "none" as const };
  }
  if (!bankName || bankRole === "none") {
    return { error: "Elegí el banco y si es caja operativa o instrumento." as const };
  }
  return { bankName, bankRole };
}

export async function createAccountAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireUser();
  const parsed = accountSchema.safeParse({
    name: formData.get("name"),
    currency: formData.get("currency"),
    purpose: parseAccountPurpose(formData.get("purpose")),
    tracksYield: formData.get("tracksYield") === "on",
    bankName: String(formData.get("bankName") ?? "").trim(),
    bankRole: parseBankRole(formData.get("bankRole")),
    isDefault: formData.get("isDefault") === "on",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const bank = bankFieldsFromForm(formData);
  if ("error" in bank) {
    return { error: bank.error };
  }

  const existing = await prisma.account.findFirst({
    where: { userId: session.userId, name: parsed.data.name },
  });

  if (existing) {
    return { error: "Ya tenés una cuenta con ese nombre." };
  }

  const count = await prisma.account.count({ where: { userId: session.userId } });
  const makeDefault = Boolean(parsed.data.isDefault) || count === 0;

  const account = await prisma.account.create({
    data: {
      name: parsed.data.name,
      currency: parsed.data.currency,
      purpose: parsed.data.purpose,
      tracksYield: Boolean(parsed.data.tracksYield),
      bankName: bank.bankName,
      bankRole: bank.bankRole,
      isDefault: false,
      userId: session.userId,
    },
  });

  const isDefault = await applyDefaultFlag(session.userId, account.id, makeDefault);
  if (isDefault) {
    await prisma.account.update({
      where: { id: account.id },
      data: { isDefault: true },
    });
  }

  revalidateAccounts();
  return { success: "Cuenta creada." };
}

export async function updateAccountAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireUser();
  const id = String(formData.get("id") ?? "");
  const parsed = accountSchema.safeParse({
    name: formData.get("name"),
    currency: formData.get("currency"),
    purpose: parseAccountPurpose(formData.get("purpose")),
    tracksYield: formData.get("tracksYield") === "on",
    bankName: String(formData.get("bankName") ?? "").trim(),
    bankRole: parseBankRole(formData.get("bankRole")),
    isDefault: formData.get("isDefault") === "on",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const bank = bankFieldsFromForm(formData);
  if ("error" in bank) {
    return { error: bank.error };
  }

  const account = await prisma.account.findFirst({
    where: { id, userId: session.userId },
  });

  if (!account) {
    return { error: "Cuenta no encontrada." };
  }

  const clash = await prisma.account.findFirst({
    where: {
      userId: session.userId,
      name: parsed.data.name,
      NOT: { id: account.id },
    },
  });

  if (clash) {
    return { error: "Ya tenés una cuenta con ese nombre." };
  }

  const makeDefault = Boolean(parsed.data.isDefault);

  await prisma.account.update({
    where: { id: account.id },
    data: {
      name: parsed.data.name,
      currency: parsed.data.currency,
      purpose: parsed.data.purpose,
      tracksYield: Boolean(parsed.data.tracksYield),
      bankName: bank.bankName,
      bankRole: bank.bankRole,
    },
  });

  if (makeDefault) {
    await prisma.account.updateMany({
      where: { userId: session.userId, isDefault: true },
      data: { isDefault: false },
    });
    await prisma.account.update({
      where: { id: account.id },
      data: { isDefault: true, active: true },
    });
  } else if (account.isDefault) {
    await prisma.account.update({
      where: { id: account.id },
      data: { isDefault: false },
    });
    const next = await prisma.account.findFirst({
      where: { userId: session.userId, NOT: { id: account.id } },
      orderBy: { createdAt: "asc" },
    });
    if (next) {
      await prisma.account.update({
        where: { id: next.id },
        data: { isDefault: true },
      });
    } else {
      await prisma.account.update({
        where: { id: account.id },
        data: { isDefault: true },
      });
    }
  }

  revalidateAccounts();
  return { success: "Cuenta actualizada." };
}

export async function deleteAccountAction(formData: FormData) {
  const session = await requireUser();
  const id = String(formData.get("id") ?? "");

  const account = await prisma.account.findFirst({
    where: { id, userId: session.userId },
  });

  if (!account) {
    return { error: "Cuenta no encontrada." };
  }

  const transferGroups = (
    await prisma.transaction.findMany({
      where: {
        userId: session.userId,
        accountId: account.id,
        transferGroupId: { not: "" },
      },
      select: { transferGroupId: true },
    })
  )
    .map((item) => item.transferGroupId)
    .filter(Boolean);

  const ops = [
    ...(transferGroups.length
      ? [
          prisma.transaction.deleteMany({
            where: {
              userId: session.userId,
              transferGroupId: { in: transferGroups },
            },
          }),
        ]
      : []),
    prisma.transaction.updateMany({
      where: { accountId: account.id, userId: session.userId },
      data: { accountId: null },
    }),
    prisma.accountBalance.deleteMany({
      where: { accountId: account.id, userId: session.userId },
    }),
    prisma.account.delete({ where: { id: account.id } }),
  ];

  await prisma.$transaction(ops);

  if (account.isDefault) {
    const next = await prisma.account.findFirst({
      where: { userId: session.userId },
      orderBy: { createdAt: "asc" },
    });
    if (next) {
      await prisma.account.update({
        where: { id: next.id },
        data: { isDefault: true },
      });
    }
  }

  revalidateAccounts();
  return { success: "Cuenta eliminada." };
}
