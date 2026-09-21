import type { AccountPurpose, BillingMode, CategoryType } from "@/lib/types";

export function isIncomeCategory(type: string) {
  return type === "income";
}

export function isExpenseLike(type: string) {
  return type === "expense" || type === "savings" || type === "neutral";
}

export function isCurrentExpense(type: string) {
  return type === "expense";
}

export function isInternalMovement(type: string) {
  return type === "savings" || type === "neutral";
}

export function isSavingsAccount(purpose: string | null | undefined) {
  return purpose === "savings";
}

export function parseAccountPurpose(value: unknown): AccountPurpose {
  return value === "savings" ? "savings" : "spending";
}

export function inferAccountPurpose(name: string): AccountPurpose {
  const normalized = name.toLowerCase();
  if (
    /superfondo|comitente|seguridad|invers|plazo fijo|\bfci\b|d[oó]lar|\busd\b|regalo/.test(
      normalized,
    )
  ) {
    return "savings";
  }
  return "spending";
}

export function transactionRefundTotal(
  refunds?: { amount: number }[] | null,
) {
  if (!refunds?.length) {
    return 0;
  }
  return Math.round(refunds.reduce((sum, item) => sum + item.amount, 0) * 100) / 100;
}

export function transactionSignedAmount(tx: {
  incomeAmount: number;
  expenseAmount: number;
  category: { type: string };
  refunds?: { amount: number }[] | null;
}) {
  if (tx.incomeAmount > 0) {
    return tx.incomeAmount;
  }
  if (tx.expenseAmount > 0) {
    return -(tx.expenseAmount - transactionRefundTotal(tx.refunds));
  }
  return 0;
}

export function transactionDisplayParts(tx: {
  incomeAmount: number;
  expenseAmount: number;
  amount?: number;
  category: { type: string };
  refunds?: { amount: number }[] | null;
}) {
  if (tx.incomeAmount > 0) {
    return {
      isIncome: true,
      amount: tx.incomeAmount,
      gross: tx.incomeAmount,
      refunded: 0,
    };
  }
  if (tx.expenseAmount > 0) {
    const refunded = transactionRefundTotal(tx.refunds);
    const net = Math.max(0, Math.round((tx.expenseAmount - refunded) * 100) / 100);
    return {
      isIncome: false,
      amount: net,
      gross: tx.expenseAmount,
      refunded,
    };
  }
  const legacy = tx.amount ?? 0;
  if (legacy > 0 && tx.category.type === "income") {
    return { isIncome: true, amount: legacy, gross: legacy, refunded: 0 };
  }
  return { isIncome: false, amount: legacy, gross: legacy, refunded: 0 };
}

export function computeIncomeBase(
  billingMode: BillingMode,
  data: { units?: number | null; unitValue?: number | null; fixedAmount?: number | null },
) {
  if (billingMode === "monthly") {
    return data.fixedAmount ?? 0;
  }
  return (data.units ?? 0) * (data.unitValue ?? 0);
}

export function billingUnitLabel(mode: BillingMode) {
  switch (mode) {
    case "hourly":
      return "Horas / unidades";
    case "weekly":
      return "Semanas";
    case "biweekly":
      return "Quincenas";
    case "project":
      return "Proyectos";
    default:
      return null;
  }
}

export function billingValueLabel(mode: BillingMode) {
  switch (mode) {
    case "hourly":
      return "Valor hora / unidad";
    case "weekly":
      return "Valor semanal";
    case "biweekly":
      return "Valor quincenal";
    case "project":
      return "Valor por proyecto";
    case "monthly":
      return "Monto mensual";
  }
}

export function computeIncomeTotal(
  billingMode: BillingMode,
  data: { units?: number | null; unitValue?: number | null; fixedAmount?: number | null },
  adjustments: { amount: number }[],
) {
  const base = computeIncomeBase(billingMode, data);
  const extras = adjustments.reduce((sum, item) => sum + item.amount, 0);
  return Math.round((base + extras) * 100) / 100;
}

export function categoryTypeLabel(type: string) {
  const map: Record<CategoryType, string> = {
    income: "Ingreso",
    expense: "Gasto",
    savings: "Ahorro / inversión",
    neutral: "Neutro",
  };
  return map[type as CategoryType] ?? type;
}

export function monthLabel(month: number) {
  return new Intl.DateTimeFormat("es-AR", { month: "long" }).format(
    new Date(2026, month - 1, 1),
  );
}

export function monthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function shiftYearMonth(year: number, month: number, delta: number) {
  const date = new Date(year, month - 1 + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

export function parseMonthKey(
  value: string | undefined,
  fallback: { year: number; month: number },
) {
  if (!value) {
    return fallback;
  }
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) {
    return fallback;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || month < 1 || month > 12) {
    return fallback;
  }
  return { year, month };
}

export function isYearMonthAfter(
  left: { year: number; month: number },
  right: { year: number; month: number },
) {
  return left.year > right.year || (left.year === right.year && left.month > right.month);
}

export function holdingCurrency(
  stored: string | null | undefined,
  accountCurrency: string,
): "ARS" | "USD" {
  if (stored === "USD") {
    return "USD";
  }
  if (accountCurrency === "USD") {
    return "USD";
  }
  return "ARS";
}

export function percentChange(current: number, previous: number) {
  if (previous === 0) {
    return current === 0 ? 0 : null;
  }
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function toUsd(amountArs: number, fxRate: number | null | undefined) {
  if (!fxRate || fxRate <= 0) {
    return null;
  }
  return Math.round((amountArs / fxRate) * 100) / 100;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

/**
 * Convert a native holding to the other currency.
 * ARS → USD uses BNA venta (you buy dollars from the bank).
 * USD → ARS uses BNA compra (you sell dollars to the bank).
 */
export function convertHoldingAmount(
  amount: number,
  currency: "ARS" | "USD",
  fx: { buy: number; sell: number } | null | undefined,
) {
  if (!fx || fx.buy <= 0 || fx.sell <= 0) {
    return null;
  }
  if (currency === "USD") {
    return { amountUsd: roundMoney(amount), amountArs: roundMoney(amount * fx.buy) };
  }
  return { amountArs: roundMoney(amount), amountUsd: roundMoney(amount / fx.sell) };
}

export function nativeHoldingAmount(item: {
  currency: string;
  amountArs: number;
  amountUsd: number;
}) {
  return item.currency === "USD" ? item.amountUsd : item.amountArs;
}

export function formatPercent(value: number | null) {
  if (value === null) {
    return "—";
  }
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

export const SOURCE_COLOR_PRESETS = [
  "#0E4A5A",
  "#C45C26",
  "#2A7A86",
  "#B8860B",
  "#5B7C5A",
  "#8B3A3A",
  "#3D5A80",
  "#A65D3F",
  "#1F6B5C",
  "#6B4C7A",
  "#D17A22",
  "#4A6FA5",
  "#7A5C45",
  "#2E8A6A",
  "#9C4A6A",
  "#5C7A3A",
  "#B05A4A",
  "#3A6B7A",
] as const;

export function nextSourceColor(used: string[]) {
  const normalized = used.map((item) => item.toUpperCase());
  const available = SOURCE_COLOR_PRESETS.find(
    (color) => !normalized.includes(color.toUpperCase()),
  );
  return available ?? SOURCE_COLOR_PRESETS[used.length % SOURCE_COLOR_PRESETS.length];
}
