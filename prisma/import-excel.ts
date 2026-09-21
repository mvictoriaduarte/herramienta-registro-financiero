import { PrismaClient } from "@prisma/client";
import XLSX from "xlsx";
import path from "path";

const prisma = new PrismaClient();

const MONTHS: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

const SOURCE_COLORS = {
  Quantum: "#0E4A5A",
  Axis: "#C45C26",
  Otros: "#2A7A86",
};

const INCOME_CONCEPTS = new Set([
  "Pago de honorarios Quantum",
  "Pago de honorarios Axis",
  "Otros honorarios",
  "Pago Claude/Cursor",
]);

const SAVINGS_CONCEPTS = new Set([
  "Ahorros/inversiones",
  "Inversiones FCI",
  "Rescates FCI",
]);

const NEUTRAL_CONCEPTS = new Set([
  "Pago tarjetas de crédito",
  "Transferencias Jo",
]);

function excelDate(serial: number) {
  const utc = Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000;
  return new Date(utc);
}

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function str(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
}

function categoryType(name: string): "income" | "expense" | "savings" | "neutral" {
  if (INCOME_CONCEPTS.has(name)) {
    return "income";
  }
  if (SAVINGS_CONCEPTS.has(name)) {
    return "savings";
  }
  if (NEUTRAL_CONCEPTS.has(name)) {
    return "neutral";
  }
  return "expense";
}

function accountCurrency(name: string): "ARS" | "USD" {
  return name.includes("(USD)") ? "USD" : "ARS";
}

function accountPurpose(name: string): "spending" | "savings" {
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

const MONTH_SHEET_NAMES: Record<number, string> = {
  1: "Enero",
  2: "Febrero",
  3: "Marzo",
  4: "Abril",
  5: "Mayo",
  6: "Junio",
  7: "Julio",
  8: "Agosto",
  9: "Septiembre",
  10: "Octubre",
  11: "Noviembre",
  12: "Diciembre",
};

/** Friday (or last known day) of a Mon–Sun day-of-month row, resolving month boundaries. */
function fridayFromWeekDays(
  sheetYear: number,
  sheetMonth: number,
  weekNumber: number,
  dayCells: (number | null)[],
): Date | null {
  const nums = dayCells.filter((d): d is number => d != null);
  if (nums.length === 0) {
    return null;
  }

  let wrapAt = -1;
  for (let i = 1; i < dayCells.length; i++) {
    const prev = dayCells[i - 1];
    const cur = dayCells[i];
    if (prev != null && cur != null && cur < prev) {
      wrapAt = i;
      break;
    }
  }

  let year = sheetYear;
  let month = sheetMonth;
  if (wrapAt >= 0 && weekNumber <= 2) {
    // Semana al inicio del mes: los días altos pertenecen al mes anterior
    month -= 1;
    if (month < 1) {
      month = 12;
      year -= 1;
    }
  }

  let prev: number | null = null;
  const resolved: (Date | null)[] = [];
  for (const day of dayCells) {
    if (day == null) {
      resolved.push(null);
      continue;
    }
    if (prev != null && day < prev) {
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }
    resolved.push(new Date(Date.UTC(year, month - 1, day, 12, 0, 0)));
    prev = day;
  }

  return resolved[4] ?? resolved.find((d) => d != null) ?? null;
}

type AxisWeekTransfer = {
  week: number;
  amount: number;
  date: Date;
  year: number;
  month: number;
};

/** Lee transferencias semanales de las hojas mensuales Axis (Semana / Ingresos / Cobrado?). */
function extractAxisWeeklyTransfers(
  wb: XLSX.WorkBook,
  year: number,
  month: number,
): AxisWeekTransfer[] {
  const sheetName = MONTH_SHEET_NAMES[month];
  const sheet = sheetName ? wb.Sheets[sheetName] : undefined;
  if (!sheet) {
    return [];
  }

  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: null,
  });

  const weekCols: { week: number; col: number }[] = [];
  const headerRow = rows[0] ?? [];
  for (let col = 0; col < headerRow.length; col++) {
    const match = str(headerRow[col]).match(/semana\s*(\d+)/i);
    if (match) {
      weekCols.push({ week: Number(match[1]), col });
    }
  }

  const fridayByWeek = new Map<number, Date>();
  const dayRow = rows[2] ?? [];
  for (const { week, col } of weekCols) {
    const dayCells: (number | null)[] = [];
    for (let offset = 0; offset < 7; offset++) {
      dayCells.push(num(dayRow[col + offset]));
    }
    const friday = fridayFromWeekDays(year, month, week, dayCells);
    if (friday) {
      fridayByWeek.set(week, friday);
    }
  }

  let summaryStart = -1;
  for (let i = 0; i < rows.length; i++) {
    if (
      str(rows[i][0]).toLowerCase() === "semana" &&
      /ingreso/i.test(str(rows[i][1]))
    ) {
      summaryStart = i + 1;
      break;
    }
  }
  if (summaryStart < 0) {
    return [];
  }

  const transfers: AxisWeekTransfer[] = [];
  for (let i = summaryStart; i < rows.length; i++) {
    const week = num(rows[i][0]);
    const amount = num(rows[i][1]);
    if (week == null || week < 1 || week > 6) {
      break;
    }
    if (amount == null || amount <= 0) {
      continue;
    }

    const date =
      fridayByWeek.get(week) ??
      new Date(Date.UTC(year, month - 1, Math.min(28, week * 7), 12, 0, 0));

    transfers.push({
      week,
      amount: Math.round(amount * 100) / 100,
      date,
      year,
      month,
    });
  }

  return transfers;
}

async function main() {
  const workbookPath = path.join(process.cwd(), "Seguimiento ingresos.xlsx");
  const wb = XLSX.readFile(workbookPath);
  const user = await prisma.user.findUnique({ where: { username: "admin" } });
  if (!user) {
    throw new Error("No existe el usuario admin. Corré npm run db:seed primero.");
  }

  console.log("Limpiando datos previos del admin...");
  await prisma.incomeAdjustment.deleteMany({
    where: { period: { userId: user.id } },
  });
  await prisma.incomePeriod.deleteMany({ where: { userId: user.id } });
  await prisma.incomeSource.deleteMany({ where: { userId: user.id } });
  await prisma.transaction.deleteMany({ where: { userId: user.id } });
  await prisma.accountBalance.deleteMany({ where: { userId: user.id } });
  await prisma.category.deleteMany({ where: { userId: user.id } });
  await prisma.account.deleteMany({ where: { userId: user.id } });

  // --- Accounts + categories from catalog ---
  const catalog = XLSX.utils.sheet_to_json<(string | number | null)[]>(
    wb.Sheets["Datos - Gastos"],
    { header: 1, defval: null },
  );

  const accountNames = new Set<string>();
  const conceptNames = new Set<string>();
  for (const row of catalog.slice(1)) {
    const concept = str(row[0]);
    const account = str(row[2]);
    if (concept) {
      conceptNames.add(concept);
    }
    if (account) {
      accountNames.add(account);
    }
  }
  // Alias seen in holdings
  accountNames.add("Mercado Libre");

  const accountsByName = new Map<string, string>();
  for (const name of accountNames) {
    const account = await prisma.account.create({
      data: {
        name,
        currency: accountCurrency(name),
        purpose: accountPurpose(name),
        userId: user.id,
      },
    });
    accountsByName.set(name, account.id);
  }
  // Map Mercado Pago <-> Mercado Libre for lookups
  if (accountsByName.has("Mercado Libre") && !accountsByName.has("Mercado Pago")) {
    accountsByName.set("Mercado Pago", accountsByName.get("Mercado Libre")!);
  }
  if (accountsByName.has("Mercado Pago") && !accountsByName.has("Mercado Libre")) {
    accountsByName.set("Mercado Libre", accountsByName.get("Mercado Pago")!);
  }

  const categoriesByName = new Map<string, string>();
  for (const name of conceptNames) {
    const category = await prisma.category.create({
      data: {
        name,
        type: categoryType(name),
        group: "",
        userId: user.id,
      },
    });
    categoriesByName.set(name, category.id);
  }

  // --- Income sources ---
  const quantum = await prisma.incomeSource.create({
    data: {
      name: "Quantum",
      billingMode: "hourly",
      color: SOURCE_COLORS.Quantum,
      defaultFxRate: 1489,
      userId: user.id,
    },
  });
  const axis = await prisma.incomeSource.create({
    data: {
      name: "Axis",
      billingMode: "weekly",
      color: SOURCE_COLORS.Axis,
      defaultFxRate: 1489,
      userId: user.id,
    },
  });
  const otros = await prisma.incomeSource.create({
    data: {
      name: "Otros",
      billingMode: "monthly",
      color: SOURCE_COLORS.Otros,
      defaultFxRate: 1489,
      userId: user.id,
    },
  });

  // Quantum detail from Ingresos - Q (prefer 2025-2026 with activity)
  const qRows = XLSX.utils.sheet_to_json<(string | number | null)[]>(
    wb.Sheets["Ingresos - Q"],
    { header: 1, defval: null },
  );

  let quantumPeriods = 0;
  for (const row of qRows.slice(1)) {
    const year = num(row[0]);
    const monthName = str(row[1]).toLowerCase();
    const month = MONTHS[monthName];
    const hours = num(row[4]);
    const rate = num(row[3]);
    if (!year || !month || year < 2025) {
      continue;
    }
    if ((hours ?? 0) <= 0 && (rate ?? 0) <= 0) {
      continue;
    }

    const mono = num(row[6]);
    const ia = num(row[7]);
    const aguinaldo = num(row[8]);

    const period = await prisma.incomePeriod.create({
      data: {
        year,
        month,
        units: hours,
        unitValue: rate,
        sourceId: quantum.id,
        userId: user.id,
      },
    });
    quantumPeriods += 1;

    const adjustments: { name: string; amount: number }[] = [];
    if (mono) {
      adjustments.push({ name: "Monotributo", amount: Math.round(mono * 100) / 100 });
    }
    if (ia) {
      adjustments.push({ name: "Devolución IA", amount: Math.round(ia * 100) / 100 });
    }
    if (aguinaldo) {
      adjustments.push({ name: "Aguinaldo", amount: Math.round(aguinaldo * 100) / 100 });
    }
    if (adjustments.length) {
      await prisma.incomeAdjustment.createMany({
        data: adjustments.map((item) => ({ ...item, periodId: period.id })),
      });
    }
  }

  // Axis: una transferencia por semana desde las hojas mensuales (Marzo…Septiembre)
  let axisPeriods = 0;
  for (let month = 1; month <= 12; month++) {
    const weeks = extractAxisWeeklyTransfers(wb, 2026, month);
    for (const week of weeks) {
      await prisma.incomePeriod.create({
        data: {
          year: week.year,
          month: week.month,
          date: week.date,
          note: `Transferencia semana ${week.week}`,
          units: 1,
          unitValue: week.amount,
          sourceId: axis.id,
          userId: user.id,
        },
      });
      axisPeriods += 1;
    }
  }

  // Otros from Ingresos totales (2026 block)
  const totals = XLSX.utils.sheet_to_json<(string | number | null)[]>(
    wb.Sheets["Ingresos totales"],
    { header: 1, defval: null },
  );

  let otrosPeriods = 0;
  for (const row of totals) {
    const year = num(row[6]);
    const monthName = str(row[7]).toLowerCase();
    const month = MONTHS[monthName];
    if (year !== 2026 || !month) {
      continue;
    }

    const concept = str(row[14]);
    const otrosAmount = num(row[15]);
    if (concept && otrosAmount && otrosAmount > 0) {
      await prisma.incomePeriod.create({
        data: {
          year,
          month,
          date: new Date(Date.UTC(year, month - 1, 15, 12, 0, 0)),
          note: concept,
          fixedAmount: Math.round(otrosAmount * 100) / 100,
          sourceId: otros.id,
          userId: user.id,
        },
      });
      otrosPeriods += 1;
    }
  }

  // --- Monthly expense sheets ---
  const monthSheets: { sheet: string; year: number; month: number }[] = [
    { sheet: "Gastos julio", year: 2026, month: 7 },
    { sheet: "Gastos agosto", year: 2026, month: 8 },
    { sheet: "Gastos septiembre", year: 2026, month: 9 },
  ];

  let txCount = 0;
  let balanceCount = 0;

  for (const { sheet, year, month } of monthSheets) {
    const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(
      wb.Sheets[sheet],
      { header: 1, defval: null },
    );

    // Holdings: rows 1-9, cols I-K inicio, M-O fin
    for (let i = 1; i <= 9; i += 1) {
      const row = rows[i];
      if (!row) {
        continue;
      }
      const startName = str(row[8]);
      const endName = str(row[12]);
      const startUsd = num(row[9]) ?? 0;
      const startArs = num(row[10]) ?? 0;
      const endUsd = num(row[13]) ?? 0;
      const endArs = num(row[14]) ?? 0;

      for (const [kind, name, usd, ars] of [
        ["start", startName, startUsd, startArs],
        ["end", endName, endUsd, endArs],
      ] as const) {
        if (!name || !accountsByName.has(name)) {
          continue;
        }
        await prisma.accountBalance.create({
          data: {
            year,
            month,
            kind,
            amountUsd: Math.round(Number(usd) * 100) / 100,
            amountArs: Math.round(Number(ars) * 100) / 100,
            accountId: accountsByName.get(name)!,
            userId: user.id,
          },
        });
        balanceCount += 1;
      }
    }

    // FX from row 6 col C (venta) when present
    const fxRate = num(rows[6]?.[2]) ?? num(rows[6]?.[1]) ?? null;

    // Parse USD block (rows after header at 15) and ARS block
    let mode: "none" | "usd" | "ars" = "none";
    for (const row of rows) {
      const label = str(row[0]);
      if (label === "Compra/venta USD") {
        mode = "usd";
        continue;
      }
      if (label === "Movimientos en ARS") {
        mode = "ars";
        continue;
      }
      if (mode === "none") {
        continue;
      }
      if (label === "Nro." || !label || Number.isNaN(Number(label))) {
        // still a data row if col0 is number
      }
      const nro = num(row[0]);
      if (nro === null) {
        continue;
      }

      const incomeRaw = num(row[1]);
      const expenseRaw = num(row[2]);
      const accountName = str(row[3]);
      const concept = str(row[4]);
      const note = str(row[5]);
      const dateSerial = num(row[6]);
      if (!accountName || !concept || dateSerial === null) {
        continue;
      }

      let accountId = accountsByName.get(accountName);
      if (!accountId) {
        const created = await prisma.account.create({
          data: {
            name: accountName,
            currency: accountCurrency(accountName),
            purpose: accountPurpose(accountName),
            userId: user.id,
          },
        });
        accountsByName.set(accountName, created.id);
        accountId = created.id;
      }

      let categoryId = categoriesByName.get(concept);
      if (!categoryId) {
        const created = await prisma.category.create({
          data: {
            name: concept,
            type: categoryType(concept),
            group: "",
            userId: user.id,
          },
        });
        categoriesByName.set(concept, created.id);
        categoryId = created.id;
      }

      const incomeAmount = Math.abs(incomeRaw ?? 0);
      const expenseAmount = Math.abs(expenseRaw ?? 0);
      if (incomeAmount === 0 && expenseAmount === 0) {
        continue;
      }

      await prisma.transaction.create({
        data: {
          incomeAmount: Math.round(incomeAmount * 100) / 100,
          expenseAmount: Math.round(expenseAmount * 100) / 100,
          amount: Math.round((incomeAmount || expenseAmount) * 100) / 100,
          date: excelDate(dateSerial),
          note,
          currency: mode === "usd" ? "USD" : "ARS",
          fxRate: mode === "usd" ? fxRate : null,
          userId: user.id,
          categoryId,
          accountId,
        },
      });
      txCount += 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        user: user.username,
        accounts: accountsByName.size,
        categories: categoriesByName.size,
        quantumPeriods,
        axisPeriods,
        otrosPeriods,
        transactions: txCount,
        balances: balanceCount,
      },
      null,
      2,
    ),
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
