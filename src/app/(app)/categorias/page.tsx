import { deleteCategoryAction } from "@/actions/categories";
import { CategoryForm, EditCategoryForm } from "@/components/CategoryForm";
import { CreatePlusModal } from "@/components/CreatePlusModal";
import { DeleteButton } from "@/components/DeleteButton";
import { IconPencil } from "@/components/ActionIcons";
import { GlassCard } from "@/components/ui";
import { categoryTypeLabel } from "@/lib/finance";
import { requireUser } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { CATEGORY_RECURRENCE_LABELS, type CategoryRecurrence } from "@/lib/types";

export default async function CategoriesPage() {
  const session = await requireUser();
  const categories = await prisma.category.findMany({
    where: { userId: session.userId },
    include: { _count: { select: { transactions: true } } },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });

  const groups = [
    { key: "expense", title: "Gastos" },
    { key: "income", title: "Ingresos" },
    { key: "savings", title: "Ahorro / inversión" },
    { key: "neutral", title: "Neutros" },
  ] as const;

  return (
    <main className="space-y-6">
      <div className="animate-in relative flex min-h-12 items-center">
        <h1 className="font-display text-4xl text-petroleum">Conceptos</h1>
        <div className="absolute right-0 top-1/2 -translate-y-1/2">
          <CreatePlusModal title="Nuevo concepto" ariaLabel="Crear concepto">
            <CategoryForm />
          </CreatePlusModal>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {groups.map((group) => (
          <CategoryList
            key={group.key}
            title={group.title}
            items={categories.filter((item) => item.type === group.key)}
          />
        ))}
      </div>
    </main>
  );
}

function CategoryList({
  title,
  items,
}: {
  title: string;
  items: {
    id: string;
    name: string;
    type: string;
    group: string;
    recurrence: string;
    _count: { transactions: number };
  }[];
}) {
  return (
    <GlassCard className="animate-in delay-1">
      <h2 className="mb-5 font-display text-2xl text-petroleum">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted">Todavía no hay conceptos de este tipo.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => {
            const recurrenceLabel =
              item.type === "expense"
                ? CATEGORY_RECURRENCE_LABELS[
                    (item.recurrence === "fijo" ? "fijo" : "eventual") as CategoryRecurrence
                  ]
                : null;

            return (
              <li
                key={item.id}
                className="flex items-center justify-between gap-4 rounded-2xl bg-white/40 px-4 py-3"
              >
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-sm text-muted">
                    {item.group || categoryTypeLabel(item.type)}
                    {recurrenceLabel ? ` · ${recurrenceLabel}` : ""} ·{" "}
                    {item._count.transactions}{" "}
                    {item._count.transactions === 1 ? "movimiento" : "movimientos"}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <CreatePlusModal
                    title="Editar concepto"
                    ariaLabel="Editar concepto"
                    trigger={<IconPencil />}
                  >
                    <EditCategoryForm
                      category={{
                        id: item.id,
                        name: item.name,
                        type: item.type,
                        group: item.group,
                        recurrence: item.recurrence,
                      }}
                    />
                  </CreatePlusModal>
                  <DeleteButton
                    action={deleteCategoryAction}
                    id={item.id}
                    icon
                    label="Eliminar concepto"
                    confirmTitle="Eliminar concepto"
                    confirmMessage={`¿Estás seguro/a de querer eliminar el concepto “${item.name}”?`}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </GlassCard>
  );
}
