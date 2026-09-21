import { PrismaClient } from "@prisma/client";
import XLSX from "xlsx";
import path from "path";

const prisma = new PrismaClient();

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

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function str(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function fridayFromWeekDays(
  sheetYear: number,
  sheetMonth: number,
  weekNumber: number,
  dayCells: (number | null)[],
): Date | null {
  const nums = dayCells.filter((d): d is number => d != null);
  if (nums.length === 0) return null;

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

function extractAxisWeeklyTransfers(wb: XLSX.WorkBook, year: number, month: number) {
  const sheetName = MONTH_SHEET_NAMES[month];
  const sheet = sheetName ? wb.Sheets[sheetName] : undefined;
  if (!sheet) return [];

  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: null,
  });

  const weekCols: { week: number; col: number }[] = [];
  const headerRow = rows[0] ?? [];
  for (let col = 0; col < headerRow.length; col++) {
    const match = str(headerRow[col]).match(/semana\s*(\d+)/i);
    if (match) weekCols.push({ week: Number(match[1]), col });
  }

  const fridayByWeek = new Map<number, Date>();
  const dayRow = rows[2] ?? [];
  for (const { week, col } of weekCols) {
    const dayCells: (number | null)[] = [];
    for (let offset = 0; offset < 7; offset++) {
      dayCells.push(num(dayRow[col + offset]));
    }
    const friday = fridayFromWeekDays(year, month, week, dayCells);
    if (friday) fridayByWeek.set(week, friday);
  }

  let summaryStart = -1;
  for (let i = 0; i < rows.length; i++) {
    if (str(rows[i][0]).toLowerCase() === "semana" && /ingreso/i.test(str(rows[i][1]))) {
      summaryStart = i + 1;
      break;
    }
  }
  if (summaryStart < 0) return [];

  const transfers: {
    week: number;
    amount: number;
    date: Date;
    year: number;
    month: number;
  }[] = [];

  for (let i = summaryStart; i < rows.length; i++) {
    const week = num(rows[i][0]);
    const amount = num(rows[i][1]);
    if (week == null || week < 1 || week > 6) break;
    if (amount == null || amount <= 0) continue;

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
  const axis = await prisma.incomeSource.findFirst({
    where: { name: { contains: "Axis" } },
  });
  if (!axis) {
    throw new Error("No se encontró la fuente Axis");
  }

  await prisma.incomeSource.update({
    where: { id: axis.id },
    data: { billingMode: "weekly" },
  });

  await prisma.incomeAdjustment.deleteMany({
    where: { period: { sourceId: axis.id } },
  });
  const deleted = await prisma.incomePeriod.deleteMany({
    where: { sourceId: axis.id },
  });

  const wb = XLSX.readFile(path.join(process.cwd(), "Seguimiento ingresos.xlsx"));
  let created = 0;
  const byMonth: Record<string, number> = {};

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
          userId: axis.userId,
        },
      });
      created += 1;
      const key = `${week.year}-${String(week.month).padStart(2, "0")}`;
      byMonth[key] = (byMonth[key] ?? 0) + 1;
    }
  }

  console.log(JSON.stringify({ deleted: deleted.count, created, byMonth }, null, 2));
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
