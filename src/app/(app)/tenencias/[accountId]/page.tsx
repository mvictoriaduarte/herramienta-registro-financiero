import Link from "next/link";
import { notFound } from "next/navigation";
import { BalanceForm } from "@/components/BalanceForm";
import { CreatePlusModal } from "@/components/CreatePlusModal";
import { HoldingKindRow } from "@/components/HoldingKindRow";
import { MonthNav } from "@/components/MonthNav";
import { GlassCard } from "@/components/ui";
import { ensureBnaFxRate } from "@/lib/bna-fx";
import {
  holdingCurrency,
  isYearMonthAfter,
  monthKey,
  monthLabel,
  parseMonthKey,
  shiftYearMonth,
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

  const [account, accounts, balances] = await Promise.all([
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
  const endArs = end?.amountArs ?? 0;
  const endUsd = end?.amountUsd ?? 0;
  const diffArs = endArs - startArs;
  const diffUsd = endUsd - startUsd;

  const prev = shiftYearMonth(cursor.year, cursor.month, -1);
  const next = shiftYearMonth(cursor.year, cursor.month, 1);
  const canGoNext = isYearMonthAfter(now, cursor);
  const monthHref = (year: number, month: number) => {
    const key = monthKey(year, month);
    const base = `/tenencias/${account.id}`;
    return key === monthKey(now.year, now.month) ? base : `${base}?mes=${key}`;
  };

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
          label="Fin"
          currency={currency}
          amountArs={endArs}
          amountUsd={endUsd}
          empty={!end}
          delay="delay-2"
        />
        <AmountCard
          label="Diferencia"
          currency={currency}
          amountArs={diffArs}
          amountUsd={diffUsd}
          empty={!start && !end}
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
    </main>
  );
}
