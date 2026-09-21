import Link from "next/link";

export function MonthNav({
  title,
  prevHref,
  nextHref,
  align = "spread",
}: {
  title: string;
  prevHref: string | null;
  nextHref: string | null;
  align?: "spread" | "start";
}) {
  const buttonClass =
    "inline-flex h-10 w-10 items-center justify-center rounded-full text-petroleum transition hover:bg-white/70";
  const disabledClass = `${buttonClass} pointer-events-none text-muted/30`;

  return (
    <div
      className={`flex items-center gap-2 ${
        align === "spread" ? "justify-between" : ""
      }`}
    >
      {prevHref ? (
        <Link href={prevHref} aria-label="Mes anterior" className={buttonClass}>
          ‹
        </Link>
      ) : (
        <span className={disabledClass}>‹</span>
      )}
      <p
        className={
          align === "spread"
            ? "font-display text-2xl capitalize text-petroleum"
            : "text-sm capitalize text-muted"
        }
      >
        {title}
      </p>
      {nextHref ? (
        <Link href={nextHref} aria-label="Mes siguiente" className={buttonClass}>
          ›
        </Link>
      ) : (
        <span className={disabledClass}>›</span>
      )}
    </div>
  );
}
