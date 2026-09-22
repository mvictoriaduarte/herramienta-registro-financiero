import type {
  AccountBankRole,
  AccountPurpose,
  BillingMode,
  CategoryType,
  TransferKind,
} from "@/lib/types";

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

export function inferTracksYield(name: string) {
  return /superfondo|comitente|plazo fijo|\bfci\b|invers/.test(name.toLowerCase());
}

export function parseBankRole(value: unknown): AccountBankRole {
  if (value === "operating" || value === "instrument") {
    return value;
  }
  return "none";
}

export function parseTransferKind(value: unknown): TransferKind {
  if (value === "investment" || value === "redemption") {
    return value;
  }
  return "normal";
}

export function isTransferMovement(kind: string | null | undefined) {
  return kind === "investment" || kind === "redemption";
}

export function inferBankName(name: string) {
  const normalized = name.toLowerCase();
  if (/santander/.test(normalized)) {
    return "Santander";
  }
  if (/galicia/.test(normalized)) {
    return "Galicia";
  }
  if (/\bbbva\b/.test(normalized)) {
    return "BBVA";
  }
  if (/macro/.test(normalized)) {
    return "Macro";
  }
  if (/naci[oó]n/.test(normalized)) {
    return "Nación";
  }
  if (/mercado\s*pago|\bmp\b/.test(normalized)) {
    return "Mercado Pago";
  }
  return "";
}

export function inferBankConfig(name: string): {
  bankName: string;
  bankRole: AccountBankRole;
} {
  const normalized = name.toLowerCase();
  const inferredName = inferBankName(name);
  const isInstrument = /superfondo|comitente|plazo fijo|\bfci\b|invers/.test(
    normalized,
  );
  const isOperating = /caja|cuenta corriente|cuenta operativa/.test(normalized);

  if (isInstrument) {
    return {
      bankName: inferredName || (/superfondo/.test(normalized) ? "Santander" : ""),
      bankRole: "instrument",
    };
  }
  if (inferredName && isOperating) {
    return { bankName: inferredName, bankRole: "operating" };
  }
  return { bankName: "", bankRole: "none" };
}

export function resolvedBank(account: {
  name: string;
  bankName?: string | null;
  bankRole?: string | null;
}) {
  const storedName = (account.bankName ?? "").trim();
  const storedRole = parseBankRole(account.bankRole);
  if (storedName && storedRole !== "none") {
    return { bankName: storedName, bankRole: storedRole };
  }
  return inferBankConfig(account.name);
}

export type BankAccountOption = {
  id: string;
  name: string;
  currency: string;
  bankName?: string | null;
  bankRole?: string | null;
};

export function bankTransferGroups(accounts: BankAccountOption[]) {
  const groups = new Map<
    string,
    {
      bankName: string;
      operating: BankAccountOption[];
      instruments: BankAccountOption[];
    }
  >();

  for (const account of accounts) {
    const { bankName, bankRole } = resolvedBank(account);
    if (!bankName || bankRole === "none") {
      continue;
    }
    const current = groups.get(bankName) ?? {
      bankName,
      operating: [],
      instruments: [],
    };
    if (bankRole === "operating") {
      current.operating.push(account);
    }
    if (bankRole === "instrument") {
      current.instruments.push(account);
    }
    groups.set(bankName, current);
  }

  return [...groups.values()]
    .filter((group) => group.operating.length > 0 && group.instruments.length > 0)
    .sort((a, b) => a.bankName.localeCompare(b.bankName, "es"));
}

export function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateKey(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function shiftDays(date: Date, days: number) {
  const next = startOfDay(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function mondayOnOrBefore(date = new Date()) {
  const current = startOfDay(date);
  const day = current.getDay();
  const offset = day === 0 ? 6 : day - 1;
  return shiftDays(current, -offset);
}

export function mondaysInMonth(
  year: number,
  month: number,
  limit = new Date(),
) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  const cap = startOfDay(limit);
  let monday = mondayOnOrBefore(start);
  if (monday < start) {
    monday = shiftDays(monday, 7);
  }
  const result: Date[] = [];
  while (monday <= end && monday <= cap) {
    result.push(new Date(monday));
    monday = shiftDays(monday, 7);
  }
  return result;
}

export function computeWeeklyYield(input: {
  previous: number | null;
  current: number;
  deposits: number;
  withdrawals: number;
}) {
  if (input.previous == null) {
    return { expected: null, net: null, percent: null };
  }
  const expected = roundMoney(input.previous + input.deposits - input.withdrawals);
  const net = roundMoney(input.current - expected);
  const percent = expected === 0 ? null : (net / Math.abs(expected)) * 100;
  return { expected, net, percent };
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

export function cashFlowInCurrency(
  tx: {
    incomeAmount: number;
    expenseAmount: number;
    amount?: number;
    currency: string;
    fxRate?: number | null;
    date?: Date;
    category: { type: string };
    refunds?: { amount: number }[] | null;
  },
  target: "ARS" | "USD",
  fx: { buy: number; sell: number } | null | undefined,
) {
  const parts = transactionDisplayParts(tx);
  const signed = parts.isIncome ? parts.amount : -parts.amount;
  const from: "ARS" | "USD" = tx.currency === "USD" ? "USD" : "ARS";
  if (from === target) {
    return roundMoney(signed);
  }
  if (from === "USD" && target === "ARS") {
    const rate = tx.fxRate && tx.fxRate > 0 ? tx.fxRate : fx?.buy;
    if (!rate || rate <= 0) {
      return 0;
    }
    return roundMoney(signed * rate);
  }
  const rate = fx?.sell;
  if (!rate || rate <= 0) {
    return 0;
  }
  return roundMoney(signed / rate);
}

type LiveHoldingBase = {
  currency: string;
  amountArs: number;
  amountUsd: number;
};

export function computeLiveHolding(input: {
  account: { currency: string; tracksYield?: boolean };
  start: LiveHoldingBase | null;
  end?: LiveHoldingBase | null;
  prevEnd?: LiveHoldingBase | null;
  weekly?: { weekDate: string; currency: string; amountArs: number; amountUsd: number }[];
  transactions: Parameters<typeof cashFlowInCurrency>[0][];
  year: number;
  month: number;
  now?: Date;
  fx: { buy: number; sell: number } | null | undefined;
}): (LiveHoldingBase & { currency: "ARS" | "USD" }) | null {
  const now = startOfDay(input.now ?? new Date());
  const monthStart = new Date(input.year, input.month - 1, 1);
  const sortedWeekly = [...(input.weekly ?? [])]
    .filter((item) => {
      const date = parseDateKey(item.weekDate);
      return date != null && date <= now;
    })
    .sort((a, b) => a.weekDate.localeCompare(b.weekDate));
  const latestWeekly = input.account.tracksYield
    ? (sortedWeekly.at(-1) ?? null)
    : null;

  let base: LiveHoldingBase | null = null;
  let flowFrom = monthStart;
  let exclusive = false;

  if (latestWeekly) {
    const week = parseDateKey(latestWeekly.weekDate);
    base = latestWeekly;
    if (week) {
      flowFrom = week;
      exclusive = true;
    }
  } else if (input.start) {
    base = input.start;
    flowFrom = monthStart;
  } else if (input.prevEnd) {
    base = input.prevEnd;
    flowFrom = monthStart;
  } else if (input.end) {
    base = input.end;
    return {
      currency: holdingCurrency(base.currency, input.account.currency),
      amountArs: base.amountArs,
      amountUsd: base.amountUsd,
    };
  }

  if (!base) {
    return null;
  }

  const currency = holdingCurrency(base.currency, input.account.currency);
  const native = nativeHoldingAmount({ ...base, currency });
  const flowTo = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const fromKey = toDateKey(flowFrom);
  const toKey = toDateKey(flowTo);
  const flows = input.transactions.reduce((sum, tx) => {
    if (tx.date) {
      const txKey = toDateKey(tx.date);
      if (exclusive ? txKey <= fromKey : txKey < fromKey) {
        return sum;
      }
      if (txKey > toKey) {
        return sum;
      }
    }
    return sum + cashFlowInCurrency(tx, currency, input.fx);
  }, 0);
  const liveNative = roundMoney(native + flows);
  const converted = convertHoldingAmount(liveNative, currency, input.fx);
  if (converted) {
    return { currency, ...converted };
  }
  return currency === "USD"
    ? { currency, amountUsd: liveNative, amountArs: 0 }
    : { currency, amountArs: liveNative, amountUsd: 0 };
}

export function collapseTransferPairs<
  T extends {
    id: string;
    incomeAmount: number;
    transferGroupId?: string | null;
    transferKind?: string | null;
  },
>(items: T[]) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    if (!isTransferMovement(item.transferKind) || !item.transferGroupId) {
      continue;
    }
    const list = groups.get(item.transferGroupId) ?? [];
    list.push(item);
    groups.set(item.transferGroupId, list);
  }

  const skipped = new Set<string>();
  const result: Array<T & { transferPartner?: T }> = [];
  for (const item of items) {
    if (skipped.has(item.id)) {
      continue;
    }
    if (!isTransferMovement(item.transferKind) || !item.transferGroupId) {
      result.push(item);
      continue;
    }
    const pair = groups.get(item.transferGroupId) ?? [item];
    const primary =
      pair.find((entry) => entry.incomeAmount <= 0 && pair.length > 1) ?? pair[0];
    const partner = pair.find((entry) => entry.id !== primary.id);
    skipped.add(primary.id);
    if (partner) {
      skipped.add(partner.id);
    }
    result.push(partner ? { ...primary, transferPartner: partner } : primary);
  }
  return result;
}

export function formatPercent(value: number | null, digits = 1) {
  if (value === null) {
    return "—";
  }
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
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
