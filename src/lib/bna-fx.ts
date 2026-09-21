import { prisma } from "@/lib/prisma";

export type BnaFxQuote = {
  date: string;
  buy: number;
  sell: number;
  source: string;
};

function todayKey(now = new Date()) {
  // Argentina mostly UTC-3; use local calendar day for cache key.
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseBnaNumber(value: string) {
  const amount = Number(value.trim().replace(",", "."));
  return Number.isFinite(amount) ? amount : NaN;
}

function parseBnaHtml(html: string): BnaFxQuote | null {
  const dateMatch = html.match(/Fecha:\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
  const dollarMatch = html.match(
    /Dolar\s*U\.?S\.?A\.?[\s\S]*?<td[^>]*>([\d.,]+)<\/td>\s*<td[^>]*>([\d.,]+)<\/td>/i,
  );

  if (!dollarMatch) {
    return null;
  }

  const buy = parseBnaNumber(dollarMatch[1] ?? "");
  const sell = parseBnaNumber(dollarMatch[2] ?? "");
  if (!Number.isFinite(buy) || !Number.isFinite(sell) || sell <= 0) {
    return null;
  }

  let date = todayKey();
  if (dateMatch) {
    const day = dateMatch[1].padStart(2, "0");
    const month = dateMatch[2].padStart(2, "0");
    const year = dateMatch[3];
    date = `${year}-${month}-${day}`;
  }

  return {
    date,
    buy: Math.round(buy * 10000) / 10000,
    sell: Math.round(sell * 10000) / 10000,
    source: "BNA",
  };
}

async function fetchBnaQuote(): Promise<BnaFxQuote | null> {
  const response = await fetch("https://www.bna.com.ar/Cotizador/MonedasHistorico", {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; herramienta-registro-financiero/1.0; +local)",
      Accept: "text/html",
      "X-Requested-With": "XMLHttpRequest",
      Referer: "https://www.bna.com.ar/Personas",
    },
    next: { revalidate: 0 },
    signal: AbortSignal.timeout(12000),
  });

  if (!response.ok) {
    return null;
  }

  return parseBnaHtml(await response.text());
}

export async function ensureBnaFxRate(): Promise<BnaFxQuote | null> {
  const today = todayKey();
  const cached = await prisma.fxRate.findUnique({ where: { date: today } });
  if (cached) {
    return {
      date: cached.date,
      buy: cached.buy,
      sell: cached.sell,
      source: cached.source,
    };
  }

  try {
    const quote = await fetchBnaQuote();
    if (!quote) {
      const latest = await prisma.fxRate.findFirst({ orderBy: { date: "desc" } });
      return latest
        ? {
            date: latest.date,
            buy: latest.buy,
            sell: latest.sell,
            source: latest.source,
          }
        : null;
    }

    const saved = await prisma.fxRate.upsert({
      where: { date: quote.date },
      update: {
        buy: quote.buy,
        sell: quote.sell,
        source: quote.source,
        fetchedAt: new Date(),
      },
      create: {
        date: quote.date,
        buy: quote.buy,
        sell: quote.sell,
        source: quote.source,
      },
    });

    // Also cache under today's key when BNA still shows last business day.
    if (saved.date !== today) {
      await prisma.fxRate.upsert({
        where: { date: today },
        update: {
          buy: saved.buy,
          sell: saved.sell,
          source: saved.source,
          fetchedAt: new Date(),
        },
        create: {
          date: today,
          buy: saved.buy,
          sell: saved.sell,
          source: saved.source,
        },
      });
    }

    return {
      date: saved.date,
      buy: saved.buy,
      sell: saved.sell,
      source: saved.source,
    };
  } catch {
    const latest = await prisma.fxRate.findFirst({ orderBy: { date: "desc" } });
    return latest
      ? {
          date: latest.date,
          buy: latest.buy,
          sell: latest.sell,
          source: latest.source,
        }
      : null;
  }
}

/** Prefer manual override; otherwise BNA venta. */
export function resolveFxRate(
  override: number | null | undefined,
  bna: BnaFxQuote | null | undefined,
) {
  if (typeof override === "number" && override > 0) {
    return override;
  }
  return bna?.sell ?? null;
}
