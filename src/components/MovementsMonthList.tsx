"use client";

import { useMemo, useState } from "react";
import {
  MovementListItem,
  type MovementListItemData,
} from "@/components/MovementListItem";
import { monthKey, monthLabel } from "@/lib/finance";

type CategoryOption = { id: string; name: string; type: string };
type AccountOption = {
  id: string;
  name: string;
  currency: string;
  active?: boolean;
  isDefault?: boolean;
  bankName?: string;
  bankRole?: string;
};

function dayKeyParts(iso: string) {
  const date = new Date(iso);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

export function MovementsMonthList({
  transactions,
  categories,
  accounts,
  bnaSell = null,
}: {
  transactions: MovementListItemData[];
  categories: CategoryOption[];
  accounts: AccountOption[];
  bnaSell?: number | null;
}) {
  const now = new Date();
  const currentKey = monthKey(now.getFullYear(), now.getMonth() + 1);
  const [openMonths, setOpenMonths] = useState<Set<string>>(() => new Set([currentKey]));

  const months = useMemo(() => {
    const map = new Map<string, MovementListItemData[]>();
    for (const item of transactions) {
      const { year, month } = dayKeyParts(item.date);
      const key = monthKey(year, month);
      const list = map.get(key);
      if (list) {
        list.push(item);
      } else {
        map.set(key, [item]);
      }
    }

    return [...map.entries()]
      .map(([key, items]) => {
        const [yearText, monthText] = key.split("-");
        const year = Number(yearText);
        const month = Number(monthText);
        return {
          key,
          year,
          month,
          label: `${monthLabel(month)} ${year}`,
          items,
        };
      })
      .sort((a, b) => b.key.localeCompare(a.key));
  }, [transactions]);

  function toggleMonth(key: string) {
    setOpenMonths((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  return (
    <div className="space-y-3">
      {months.map((group) => {
        const open = openMonths.has(group.key);
        return (
          <section key={group.key} className="overflow-hidden rounded-2xl bg-white/35">
            <button
              type="button"
              onClick={() => toggleMonth(group.key)}
              aria-expanded={open}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-white/40"
            >
              <span className="font-display text-xl capitalize text-petroleum">
                {group.label}
              </span>
              <span className="flex items-center gap-3">
                <span className="text-sm text-muted">
                  {group.items.length}{" "}
                  {group.items.length === 1 ? "movimiento" : "movimientos"}
                </span>
                <svg
                  viewBox="0 0 24 24"
                  className={`h-5 w-5 text-petroleum transition-transform duration-200 ${
                    open ? "rotate-180" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </span>
            </button>
            {open ? (
              <ul className="space-y-3 border-t border-white/50 px-3 pb-3 pt-3">
                {group.items.map((item) => (
                  <MovementListItem
                    key={item.id}
                    item={item}
                    categories={categories}
                    accounts={accounts}
                    bnaSell={bnaSell}
                  />
                ))}
              </ul>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
