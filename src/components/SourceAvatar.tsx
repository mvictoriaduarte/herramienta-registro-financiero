export function SourceAvatar({
  name,
  color,
  logoUrl,
  size = "md",
}: {
  name: string;
  color: string;
  logoUrl?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass =
    size === "lg"
      ? "h-14 w-14 rounded-2xl text-lg shadow-lg"
      : size === "sm"
        ? "h-9 w-9 rounded-xl text-xs shadow-sm"
        : "h-11 w-11 rounded-2xl text-sm shadow-md";

  if (logoUrl) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center overflow-hidden bg-white ${sizeClass}`}
      >
        <img src={logoUrl} alt={name} className="h-full w-full object-cover" />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center font-bold text-white ${sizeClass}`}
      style={{ backgroundColor: color }}
    >
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}
