export function IncomeBarChart({
  months,
  series,
}: {
  months: { key: string; label: string }[];
  series: { id: string; name: string; color: string; values: number[] }[];
}) {
  const max = Math.max(...series.flatMap((item) => item.values), 1);

  return (
    <div className="space-y-4">
      <div className="flex h-52 items-end gap-3">
        {months.map((month, monthIndex) => {
          const monthTotal = series.reduce((sum, item) => sum + (item.values[monthIndex] ?? 0), 0);
          return (
            <div key={month.key} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <div className="flex h-40 w-full items-end justify-center gap-0.5">
                {series.map((item) => {
                  const value = item.values[monthIndex] ?? 0;
                  const height = value > 0 ? Math.max(4, (value / max) * 100) : 0;
                  return (
                    <div
                      key={item.id}
                      className="w-full max-w-3 rounded-t-md transition-all duration-700"
                      style={{
                        height: `${height}%`,
                        backgroundColor: item.color,
                        opacity: value > 0 ? 1 : 0.15,
                      }}
                      title={`${item.name}: ${value.toLocaleString("es-AR")}`}
                    />
                  );
                })}
              </div>
              <span className="truncate text-[11px] capitalize text-muted">{month.label}</span>
              <span className="sr-only">Total {monthTotal}</span>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-3">
        {series.map((item) => (
          <div key={item.id} className="flex items-center gap-2 text-sm text-muted">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
            {item.name}
          </div>
        ))}
      </div>
    </div>
  );
}

export function IncomeCompositionChart({
  items,
}: {
  items: { id: string; name: string; color: string; value: number }[];
}) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  if (total <= 0) {
    return <p className="text-sm text-muted">Todavía no hay ingresos para graficar.</p>;
  }

  let offset = 0;
  const segments = items
    .filter((item) => item.value > 0)
    .map((item) => {
      const portion = (item.value / total) * 100;
      const start = offset;
      offset += portion;
      return { ...item, portion, start };
    });

  const gradient = segments
    .map((item) => `${item.color} ${item.start}% ${item.start + item.portion}%`)
    .join(", ");

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
      <div
        className="h-40 w-40 shrink-0 rounded-full shadow-inner"
        style={{
          background: `conic-gradient(${gradient})`,
          mask: "radial-gradient(circle at center, transparent 42%, black 43%)",
          WebkitMask: "radial-gradient(circle at center, transparent 42%, black 43%)",
        }}
        aria-label="Composición de ingresos"
      />
      <ul className="w-full space-y-2">
        {segments.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
              {item.name}
            </span>
            <span className="font-medium text-petroleum">{item.portion.toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RateSparkline({
  values,
  color,
}: {
  values: number[];
  color: string;
}) {
  if (values.length === 0) {
    return <p className="text-sm text-muted">Sin datos de tarifa todavía.</p>;
  }

  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);
  const points = values
    .map((value, index) => {
      const x = values.length === 1 ? 50 : (index / (values.length - 1)) * 100;
      const y = 100 - ((value - min) / range) * 100;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox="0 0 100 100" className="h-24 w-full" preserveAspectRatio="none">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
