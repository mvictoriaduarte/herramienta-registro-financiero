import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const axis = await prisma.incomeSource.findFirst({
    where: { name: { contains: "Axis" } },
  });
  console.log("source", axis);
  if (!axis) {
    return;
  }

  const periods = await prisma.incomePeriod.findMany({
    where: { sourceId: axis.id },
    orderBy: [{ year: "desc" }, { month: "desc" }, { date: "desc" }],
  });

  const byMonth: Record<string, number> = {};
  for (const row of periods) {
    const key = `${row.year}-${String(row.month).padStart(2, "0")}`;
    byMonth[key] = (byMonth[key] ?? 0) + 1;
  }

  console.log("count", periods.length);
  console.log("byMonth", byMonth);
  console.log(
    "rows",
    periods.map((r) => ({
      date: r.date.toISOString().slice(0, 10),
      year: r.year,
      month: r.month,
      units: r.units,
      unitValue: r.unitValue,
      fixed: r.fixedAmount,
      note: r.note,
    })),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
