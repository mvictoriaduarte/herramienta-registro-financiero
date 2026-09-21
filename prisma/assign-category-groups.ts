import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** Grupos alineados a CATEGORY_GROUPS en src/lib/types.ts */
const GROUP_BY_NAME: Record<string, string> = {
  // Comidas y salidas
  Delivery: "Comidas y salidas",
  "Juntadas a cenar/almorzar": "Comidas y salidas",
  "Juntadas a desayunar/merendar": "Comidas y salidas",
  "Salidas a cenar/almorzar": "Comidas y salidas",
  "Salidas a desyunar/merendar": "Comidas y salidas",
  "Salidas a tomar algo": "Comidas y salidas",

  // Regalos y eventos
  "Entradas fiestas/conciertos/otros eventos": "Regalos y eventos",
  Fiestas: "Regalos y eventos",
  Regalos: "Regalos y eventos",

  // Transporte
  Auto: "Transporte",

  // Salud y bienestar
  "Farmacia/Cosméticos": "Salud y bienestar",
  Gimnasio: "Salud y bienestar",
  Psicóloga: "Salud y bienestar",

  // Ropa y personal
  Ropa: "Ropa y personal",
  "Telas e insumos p costura": "Ropa y personal",
  "Compras varias": "Ropa y personal",

  // Hogar y súper
  Súper: "Hogar y súper",
  Mascotas: "Hogar y súper",

  // Servicios y suscripciones
  Celular: "Servicios y suscripciones",

  // Impuestos
  "Pago monotributo": "Impuestos",

  // Ingresos
  "Otros honorarios": "Ingresos",
  "Pago Claude/Cursor": "Ingresos",
  "Pago de honorarios Axis": "Ingresos",
  "Pago de honorarios Quantum": "Ingresos",

  // Ahorro/Inversión
  "Ahorros/inversiones": "Ahorro/Inversión",
  "Inversiones FCI": "Ahorro/Inversión",
  "Rescates FCI": "Ahorro/Inversión",

  // Neutro
  "Pago tarjetas de crédito": "Neutro",
  "Transferencias Jo": "Neutro",
};

async function main() {
  const categories = await prisma.category.findMany();
  let updated = 0;
  let skipped = 0;

  for (const category of categories) {
    const group = GROUP_BY_NAME[category.name];
    if (!group) {
      console.log(`Sin mapeo: ${category.type} · ${category.name}`);
      skipped += 1;
      continue;
    }
    if (category.group === group) {
      skipped += 1;
      continue;
    }
    await prisma.category.update({
      where: { id: category.id },
      data: { group },
    });
    console.log(`${category.name} → ${group}`);
    updated += 1;
  }

  console.log(`\nActualizados: ${updated}. Sin cambio: ${skipped}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
