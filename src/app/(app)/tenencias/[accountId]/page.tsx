import Link from "next/link";
import { notFound } from "next/navigation";
import { BalanceForm } from "@/components/BalanceForm";
import { CreatePlusModal } from "@/components/CreatePlusModal";
import { HoldingKindRow } from "@/components/HoldingKindRow";
import { MonthNav } from "@/components/MonthNav";
import { GlassCard } from "@/components/ui";
import { WeeklyYieldSection, type WeeklyYieldRow } from "@/components/WeeklyYieldSection";
import { ensureBnaFxRate } from "@/lib/bna-fx";
import {
  computeLiveHolding,
  computeWeeklyYield,
  holdingCurrency,
  isYearMonthAfter,
  mondaysInMonth,
  monthKey,
  monthLabel,
  nativeHoldingAmount,
  parseDateKey,
  parseMonthKey,
  shiftDays,
  shiftYearMonth,
  toDateKey,
  transactionDisplayParts,
} from "@/lib/finance";
import { currentYearMonth, formatMoney } from "@/lib/format";
import { requireUser } from "@/lib/guards";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{ accountId: string }>;
  searchParams: Promise<{ mes?: string }>;
};

function AmountCard({
  label,
  currency,
  amountArs,
  amountUsd,
  empty,
  delay,
}: {
  label: string;
  currency: "ARS" | "USD";
  amountArs: number;
  amountUsd: number;
  empty: boolean;
  delay: string;
}) {
  const primary =
    currency === "USD" ? formatMoney(amountUsd, "USD") : formatMoney(amountArs);
  const secondary =
    currency === "USD" ? formatMoney(amountArs) : formatMoney(amountUsd, "USD");

  return (
    <GlassCard className={`animate-in ${delay}`}>
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-3 font-display text-3xl text-petroleum">{empty ? "—" : primary}</p>
      {empty ? null : <p className="mt-2 text-sm text-muted">{secondary}</p>}
    </GlassCard>
  );
}

export default async function HoldingAccountPage({ params, searchParams }: PageProps) {
  const session = await requireUser();
  const { accountId } = await params;
  const now = currentYearMonth();
  const requested = parseMonthKey((await searchParams).mes, now);
  const cursor = isYearMonthAfter(requested, now) ? now : requested;
  const bnaFx = await ensureBnaFxRate();
  const mondays = mondaysInMonth(cursor.year, cursor.month);
  const mondayKeys = mondays.map(toDateKey);
  const firstPrevMonday = mondays[0] ? shiftDays(mondays[0], -7) : null;

  const prev = shiftYearMonth(cursor.year, cursor.month, -1);
  const isCurrentMonth = cursor.year === now.year && cursor.month === now.month;
  const flowFrom = firstPrevMonday ?? new Date(cursor.year, cursor.month - 1, 1);
  const flowTo = isCurrentMonth
    ? new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        new Date().getDate(),
        23,
        59,
        59,
        999,
      )
    : new Date(cursor.year, cursor.month, 0, 23, 59, 59, 999);

  const [account, accounts, balances, weeklySnapshots, weekTransactions, prevEnd] =
    await Promise.all([
      prisma.account.findFirst({
        where: { id: accountId, userId: session.userId },
      }),
      prisma.account.findMany({
        where: { userId: session.userId },
        orderBy: { name: "asc" },
      }),
      prisma.accountBalance.findMany({
        where: {
          userId: session.userId,
          accountId,
          year: cursor.year,
          month: cursor.month,
        },
      }),
      firstPrevMonday
        ? prisma.accountWeeklySnapshot.findMany({
            where: {
              userId: session.userId,
              accountId,
              weekDate: { gte: toDateKey(firstPrevMonday) },
            },
          })
        : Promise.resolve([]),
      prisma.transaction.findMany({
        where: {
          userId: session.userId,
          accountId,
          date: { gte: flowFrom, lte: flowTo },
        },
        include: { category: true, refunds: true },
      }),
      prisma.accountBalance.findFirst({
        where: {
          userId: session.userId,
          accountId,
          year: prev.year,
          month: prev.month,
          kind: "end",
        },
      }),
    ]);

  if (!account) {
    notFound();
  }

  const start = balances.find((item) => item.kind === "start") ?? null;
  const end = balances.find((item) => item.kind === "end") ?? null;
  const currency = holdingCurrency(
    end?.currency ?? start?.currency,
    account.currency,
  );
  const startArs = start?.amountArs ?? 0;
  const startUsd = start?.amountUsd ?? 0;
  const live = isCurrentMonth
    ? computeLiveHolding({
        account,
        start,
        end,
        prevEnd,
        weekly: weeklySnapshots,
        transactions: weekTransactions,
        year: cursor.year,
        month: cursor.month,
        fx: bnaFx,
      })
    : null;
  const shownEnd = live ??
    (end
      ? {
          currency,
          amountArs: end.amountArs,
          amountUsd: end.amountUsd,
        }
      : null);
  const endArs = shownEnd?.amountArs ?? 0;
  const endUsd = shownEnd?.amountUsd ?? 0;
  const diffArs = endArs - startArs;
  const diffUsd = endUsd - startUsd;
  const endLabel = isCurrentMonth ? "Actual" : "Fin";

  const next = shiftYearMonth(cursor.year, cursor.month, 1);
  const canGoNext = isYearMonthAfter(now, cursor);
  const monthHref = (year: number, month: number) => {
    const key = monthKey(year, month);
    const base = `/tenencias/${account.id}`;
    return key === monthKey(now.year, now.month) ? base : `${base}?mes=${key}`;
  };

  const snapshotByDate = new Map(
    weeklySnapshots.map((item) => [item.weekDate, item]),
  );
  const nativeOf = (weekDate: string) => {
    const snapshot = snapshotByDate.get(weekDate);
    if (!snapshot) {
      return null;
    }
    return nativeHoldingAmount({
      currency: holdingCurrency(snapshot.currency, account.currency),
      amountArs: snapshot.amountArs,
      amountUsd: snapshot.amountUsd,
    });
  };
  const weeklyRows: WeeklyYieldRow[] = mondayKeys.map((weekDate) => {
    const monday = parseDateKey(weekDate);
    const snapshot = snapshotByDate.get(weekDate) ?? null;
    const previousDate = monday ? toDateKey(shiftDays(monday, -7)) : null;
    const previous = previousDate ? nativeOf(previousDate) : null;
    const current = snapshot
      ? nativeHoldingAmount({
          currency: holdingCurrency(snapshot.currency, account.currency),
          amountArs: snapshot.amountArs,
          amountUsd: snapshot.amountUsd,
        })
      : null;
    const prevMonday = monday ? shiftDays(monday, -7) : null;
    const fromKey = prevMonday ? toDateKey(prevMonday) : null;
    const toKey = monday ? toDateKey(monday) : null;
    const flows = weekTransactions.filter((item) => {
      if (!fromKey || !toKey || !item.date) {
        return false;
      }
      const txKey = toDateKey(item.date);
      return txKey > fromKey && txKey <= toKey;
    });
    let deposits = 0;
    let withdrawals = 0;
    for (const item of flows) {
      const parts = transactionDisplayParts(item);
      if (parts.isIncome) {
        deposits += parts.amount;
      } else {
        withdrawals += parts.amount;
      }
    }
    deposits = Math.round(deposits * 100) / 100;
    withdrawals = Math.round(withdrawals * 100) / 100;
    const yieldResult = computeWeeklyYield({
      previous,
      current: current ?? 0,
      deposits,
      withdrawals,
    });

    return {
      weekDate,
      snapshot: snapshot
        ? {
            id: snapshot.id,
            accountId: snapshot.accountId,
            weekDate: snapshot.weekDate,
            currency: snapshot.currency === "USD" ? "USD" : "ARS",
            amountArs: snapshot.amountArs,
            amountUsd: snapshot.amountUsd,
          }
        : null,
      deposits,
      withdrawals,
      previous,
      current,
      expected: snapshot ? yieldResult.expected : null,
      net: snapshot ? yieldResult.net : null,
      percent: snapshot ? yieldResult.percent : null,
    };
  });

  return (
    <main className="space-y-6">
      <div className="animate-in relative space-y-4">
        <Link
          href="/tenencias"
          aria-label="Volver a tenencias"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full text-petroleum transition hover:bg-white/60"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>

        <div className="relative flex min-h-12 items-center pr-14">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-petroleum-soft">
              Tenencia
            </p>
            <h1 className="font-display text-4xl text-petroleum">{account.name}</h1>
          </div>
          <div className="absolute right-0 top-1/2 -translate-y-1/2">
            <CreatePlusModal title="Cargar tenencia" ariaLabel="Cargar tenencia">
              <BalanceForm
                accounts={accounts}
                bnaFx={bnaFx}
                defaults={{
                  accountId: account.id,
                  year: cursor.year,
                  month: cursor.month,
                }}
              />
            </CreatePlusModal>
          </div>
        </div>

        <MonthNav
          title={`${monthLabel(cursor.month)} ${cursor.year}`}
          prevHref={monthHref(prev.year, prev.month)}
          nextHref={canGoNext ? monthHref(next.year, next.month) : null}
          align="start"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <AmountCard
          label="Inicio"
          currency={currency}
          amountArs={startArs}
          amountUsd={startUsd}
          empty={!start}
          delay="delay-1"
        />
        <AmountCard
          label={endLabel}
          currency={shownEnd ? holdingCurrency(shownEnd.currency, account.currency) : currency}
          amountArs={endArs}
          amountUsd={endUsd}
          empty={!shownEnd}
          delay="delay-2"
        />
        <AmountCard
          label="Diferencia"
          currency={currency}
          amountArs={diffArs}
          amountUsd={diffUsd}
          empty={!start && !shownEnd}
          delay="delay-3"
        />
      </div>

      <GlassCard className="animate-in delay-3">
        <h2 className="mb-5 font-display text-2xl text-petroleum">Inicio y fin</h2>
        <ul className="space-y-3">
          <HoldingKindRow
            kind="start"
            record={start}
            account={account}
            accounts={accounts}
            year={cursor.year}
            month={cursor.month}
            bnaFx={bnaFx}
          />
          <HoldingKindRow
            kind="end"
            record={end}
            account={account}
            accounts={accounts}
            year={cursor.year}
            month={cursor.month}
            bnaFx={bnaFx}
          />
        </ul>
      </GlassCard>

      {account.tracksYield ? (
        <WeeklyYieldSection
          account={account}
          accounts={accounts.filter((item) => item.id === account.id || item.tracksYield)}
          rows={weeklyRows}
          mondays={mondayKeys}
          currency={currency}
          bnaFx={bnaFx}
        />
      ) : null}
    </main>
  );
}
