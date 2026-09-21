import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const FIXED_EXPENSES = new Set([
  "Gimnasio",
  "Psicóloga",
  "Celular",
  "Pago monotributo",
]);

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, username: true } });

  for (const user of users) {
    const accounts = await prisma.account.findMany({ where: { userId: user.id } });
    const hasDefault = accounts.some((item) => item.isDefault);

    if (!hasDefault && accounts.length > 0) {
      const santander =
        accounts.find((item) =>
          item.name.toLowerCase().includes("santander"),
        ) ?? accounts[0];

      await prisma.account.updateMany({
        where: { userId: user.id },
        data: { isDefault: false },
      });
      await prisma.account.update({
        where: { id: santander.id },
        data: { isDefault: true },
      });
      console.log(`${user.username}: default → ${santander.name}`);
    }

    const expenses = await prisma.category.findMany({
      where: { userId: user.id, type: "expense" },
    });

    for (const category of expenses) {
      const recurrence = FIXED_EXPENSES.has(category.name) ? "fijo" : "eventual";
      if (category.recurrence !== recurrence) {
        await prisma.category.update({
          where: { id: category.id },
          data: { recurrence },
        });
        console.log(`${user.username}: ${category.name} → ${recurrence}`);
      }
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
