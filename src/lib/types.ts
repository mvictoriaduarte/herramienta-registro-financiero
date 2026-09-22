export type ActionState = {
  error?: string;
  success?: string;
} | null;

export type CategoryType = "income" | "expense" | "savings" | "neutral";

export type BillingMode = "hourly" | "weekly" | "biweekly" | "monthly" | "project";

export type CurrencyCode = "ARS" | "USD";

export type BalanceKind = "start" | "end";

export type AccountPurpose = "spending" | "savings";

export type AccountBankRole = "none" | "operating" | "instrument";

export type TransferKind = "normal" | "investment" | "redemption";

export const ACCOUNT_PURPOSE_LABELS: Record<AccountPurpose, string> = {
  spending: "Gastos corrientes / corto plazo",
  savings: "Ahorro / inversión",
};

export const ACCOUNT_BANK_ROLE_LABELS: Record<Exclude<AccountBankRole, "none">, string> = {
  operating: "Caja / cuenta operativa",
  instrument: "Instrumento de inversión",
};

export const TRANSFER_KIND_LABELS: Record<Exclude<TransferKind, "normal">, string> = {
  investment: "Inversión",
  redemption: "Rescate",
};

export const CATEGORY_TYPE_LABELS: Record<CategoryType, string> = {
  income: "Ingreso",
  expense: "Gasto",
  savings: "Ahorro / inversión",
  neutral: "Neutro",
};

export const BILLING_MODE_LABELS: Record<BillingMode, string> = {
  hourly: "Por hora / unidad",
  weekly: "Semanal",
  biweekly: "Quincenal",
  monthly: "Mensual",
  project: "Por proyecto",
};

export const CATEGORY_GROUPS = [
  "Comidas y salidas",
  "Regalos y eventos",
  "Transporte",
  "Salud y bienestar",
  "Ropa y personal",
  "Hogar y súper",
  "Servicios y suscripciones",
  "Impuestos",
  "Ingresos",
  "Ahorro/Inversión",
  "Neutro",
] as const;

export const EXPENSE_CATEGORY_GROUPS = [
  "Comidas y salidas",
  "Regalos y eventos",
  "Transporte",
  "Salud y bienestar",
  "Ropa y personal",
  "Hogar y súper",
  "Servicios y suscripciones",
  "Impuestos",
] as const;

export type CategoryRecurrence = "fijo" | "eventual";

export const CATEGORY_RECURRENCE_LABELS: Record<CategoryRecurrence, string> = {
  fijo: "Fijo",
  eventual: "Eventual",
};

export function groupsForCategoryType(type: CategoryType) {
  if (type === "income") {
    return ["Ingresos"] as const;
  }
  if (type === "savings") {
    return ["Ahorro/Inversión"] as const;
  }
  if (type === "neutral") {
    return ["Neutro"] as const;
  }
  return EXPENSE_CATEGORY_GROUPS;
}
