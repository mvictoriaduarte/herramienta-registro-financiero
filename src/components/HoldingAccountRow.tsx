import Link from "next/link";
import { holdingCurrency } from "@/lib/finance";
import { formatMoney } from "@/lib/format";

type AccountOption = {
  id: string;
  name: string;
  currency: string;
};

type CurrentBalance = {
  currency: string;
  amountArs: number;
  amountUsd: number;
} | null;

function amountLabel(
  currency: "ARS" | "USD",
  amountArs: number,
  amountUsd: number,
) {
  return currency === "USD"
    ? `${formatMoney(amountUsd, "USD")} · ${formatMoney(amountArs)}`
    : `${formatMoney(amountArs)} · ${formatMoney(amountUsd, "USD")}`;
}

export function HoldingAccountRow({
  account,
  current,
}: {
  account: AccountOption;
  current: CurrentBalance;
}) {
  const currency = holdingCurrency(current?.currency, account.currency);

  return (
    <li>
      <Link
        href={`/tenencias/${account.id}`}
        className="flex flex-col gap-3 rounded-2xl bg-white/40 px-4 py-3 transition hover:bg-white/70 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <p className="font-medium">{account.name}</p>
          <p className="text-sm text-muted">
            {current
              ? amountLabel(currency, current.amountArs, current.amountUsd)
              : "Sin tenencia este mes"}
          </p>
        </div>
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
          Entrar
        </span>
      </Link>
    </li>
  );
}
