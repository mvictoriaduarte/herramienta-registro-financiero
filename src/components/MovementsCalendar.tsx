"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  MovementListItem,
  type MovementListItemData,
} from "@/components/MovementListItem";
import { GlassCard } from "@/components/ui";
import { monthLabel, isTransferMovement, transactionSignedAmount } from "@/lib/finance";
import { formatMoney, toDateInputValue } from "@/lib/format";

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

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function dayKeyFromDate(date: Date) {
  return toDateInputValue(date);
}

function dayKeyFromIso(iso: string) {
  return toDateInputValue(new Date(iso));
}

function toArs(
  signed: number,
  currency: string,
  fxRate: number | null,
  bnaSell: number | null,
) {
  if (currency === "ARS") {
    return signed;
  }
  const rate = fxRate && fxRate > 0 ? fxRate : bnaSell;
  if (!rate || rate <= 0) {
    return signed;
  }
  return Math.round(signed * rate * 100) / 100;
}

function formatCellNet(amount: number) {
  const abs = Math.abs(amount);
  const compact =
    abs >= 1_000_000
      ? `${(abs / 1_000_000).toFixed(1)}M`
      : abs >= 10_000
        ? `${Math.round(abs / 1000)}k`
        : abs >= 1000
          ? `${(abs / 1000).toFixed(1)}k`
          : abs.toLocaleString("es-AR", { maximumFractionDigits: 0 });
  return `${amount > 0 ? "+" : "−"}${compact}`;
}

export function MovementsCalendar({
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
  const today = new Date();
  const [cursor, setCursor] = useState({
    year: today.getFullYear(),
    month: today.getMonth() + 1,
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!selectedDay) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedDay(null);
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [selectedDay]);

  const { netsByDay, countsByDay } = useMemo(() => {
    const nets = new Map<string, number>();
    const counts = new Map<string, number>();
    for (const item of transactions) {
      const key = dayKeyFromIso(item.date);
      counts.set(key, (counts.get(key) ?? 0) + 1);
      if (isTransferMovement(item.transferKind)) {
        continue;
      }
      const signed = transactionSignedAmount(item);
      const ars = toArs(signed, item.currency, item.fxRate, bnaSell);
      nets.set(key, Math.round(((nets.get(key) ?? 0) + ars) * 100) / 100);
    }
    return { netsByDay: nets, countsByDay: counts };
  }, [transactions, bnaSell]);

  const monthDays = useMemo(() => {
    const first = new Date(cursor.year, cursor.month - 1, 1);
    const daysInMonth = new Date(cursor.year, cursor.month, 0).getDate();
    const startPad = (first.getDay() + 6) % 7;
    const cells: ({ day: number; key: string } | null)[] = [];
    for (let i = 0; i < startPad; i += 1) {
      cells.push(null);
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      const key = `${cursor.year}-${String(cursor.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      cells.push({ day, key });
    }
    while (cells.length % 7 !== 0) {
      cells.push(null);
    }
    return cells;
  }, [cursor]);

  const selectedItems = useMemo(() => {
    if (!selectedDay) {
      return [];
    }
    return transactions
      .filter((item) => dayKeyFromIso(item.date) === selectedDay)
      .sort(
        (a, b) =>
          new Date(b.date).getTime() - new Date(a.date).getTime() ||
          a.category.name.localeCompare(b.category.name, "es"),
      );
  }, [transactions, selectedDay]);

  const selectedNet = selectedDay ? (netsByDay.get(selectedDay) ?? 0) : 0;
  const selectedLabel = selectedDay
    ? (() => {
        const raw = new Intl.DateTimeFormat("es-AR", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        }).format(new Date(`${selectedDay}T12:00:00`));
        // "domingo, 20 de septiembre de 2026" → capitalizar solo el día de la semana
        return raw.replace(/^./, (char) => char.toLocaleUpperCase("es-AR"));
      })()
    : "";

  const monthTitle = `${monthLabel(cursor.month)} ${cursor.year}`;
  const close = () => setSelectedDay(null);

  function shiftMonth(delta: number) {
    const next = new Date(cursor.year, cursor.month - 1 + delta, 1);
    setCursor({ year: next.getFullYear(), month: next.getMonth() + 1 });
  }

  const dayModal =
    selectedDay && mounted
      ? createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <button
              type="button"
              className="absolute inset-0 bg-petroleum-deep/35 backdrop-blur-sm"
              aria-label="Cerrar"
              onClick={close}
            />
            <div className="glass-panel relative z-10 max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[28px] p-6 shadow-2xl sm:p-8">
              <div className="mb-2 flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-display text-3xl text-petroleum">
                    {selectedLabel}
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    Neto del día{" "}
                    <span
                      className={`font-semibold ${
                        selectedNet > 0
                          ? "text-emerald-700"
                          : selectedNet < 0
                            ? "text-rose-700"
                            : "text-petroleum"
                      }`}
                    >
                      {selectedNet > 0 ? "+" : selectedNet < 0 ? "−" : ""}
                      {formatMoney(Math.abs(selectedNet))}
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Cerrar"
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-white/60 hover:text-petroleum"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>

              <div className="mt-6">
                {selectedItems.length === 0 ? (
                  <p className="text-sm text-muted">Sin movimientos este día.</p>
                ) : (
                  <ul className="space-y-3">
                    {selectedItems.map((item) => (
                      <MovementListItem
                        key={item.id}
                        item={item}
                        categories={categories}
                        accounts={accounts}
                        bnaSell={bnaSell}
                      />
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <section>
      <GlassCard>
        <div className="mb-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-petroleum transition hover:bg-white/70"
            aria-label="Mes anterior"
          >
            ‹
          </button>
          <h2 className="font-display text-2xl capitalize text-petroleum">{monthTitle}</h2>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-petroleum transition hover:bg-white/70"
            aria-label="Mes siguiente"
          >
            ›
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {WEEKDAYS.map((label) => (
            <div
              key={label}
              className="px-1 pb-2 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-muted"
            >
              {label}
            </div>
          ))}
          {monthDays.map((cell, index) => {
            if (!cell) {
              return <div key={`pad-${index}`} className="min-h-16 sm:min-h-20" />;
            }
            const net = netsByDay.get(cell.key) ?? 0;
            const selected = selectedDay === cell.key;
            const isToday = cell.key === dayKeyFromDate(today);
            const hasMovements = (countsByDay.get(cell.key) ?? 0) > 0;

            return (
              <button
                key={cell.key}
                type="button"
                onClick={() => setSelectedDay(cell.key)}
                className={`flex min-h-16 flex-col items-stretch rounded-2xl px-1.5 py-1.5 text-left transition sm:min-h-20 sm:px-2 sm:py-2 ${
                  selected
                    ? "bg-petroleum text-white shadow-[0_10px_24px_rgba(14,74,90,0.2)]"
                    : isToday
                      ? "bg-white/70 ring-1 ring-petroleum/30 hover:bg-white/90"
                      : "bg-white/40 hover:bg-white/70"
                }`}
              >
                <span
                  className={`text-xs font-semibold sm:text-sm ${
                    selected ? "text-white/80" : "text-muted"
                  }`}
                >
                  {cell.day}
                </span>
                {hasMovements ? (
                  <span
                    className={`mt-auto text-[10px] font-semibold leading-tight sm:text-xs ${
                      selected
                        ? "text-white"
                        : net > 0
                          ? "text-emerald-700"
                          : net < 0
                            ? "text-rose-700"
                            : "text-petroleum"
                    }`}
                  >
                    {formatCellNet(net)}
                  </span>
                ) : (
                  <span className="mt-auto text-[10px] text-transparent sm:text-xs">—</span>
                )}
              </button>
            );
          })}
        </div>
      </GlassCard>
      {dayModal}
    </section>
  );
}
