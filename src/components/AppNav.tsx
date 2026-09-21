"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/actions/auth";

const links = [
  { href: "/dashboard", label: "Análisis" },
  { href: "/movimientos", label: "Movimientos" },
  { href: "/ingresos", label: "Ingresos" },
  { href: "/cuentas", label: "Cuentas" },
  { href: "/categorias", label: "Conceptos" },
  { href: "/tenencias", label: "Tenencias" },
];

export function AppNav({
  username,
  isAdmin,
}: {
  username: string;
  isAdmin: boolean;
}) {
  const pathname = usePathname();

  return (
    <header className="sticky top-4 z-20 mx-auto mb-8 w-full max-w-6xl px-4">
      <div className="glass-panel flex flex-col gap-4 rounded-[28px] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Link href="/dashboard" className="font-display text-xl text-petroleum">
            Registro financiero
          </Link>
          <p className="text-sm text-muted">Hola, {username}</p>
        </div>
        <nav className="flex flex-wrap items-center gap-2">
          {links.map((link) => {
            const active = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-2xl px-3 py-2 text-sm font-medium ${
                  active
                    ? "bg-petroleum text-white shadow-[0_10px_24px_rgba(14,74,90,0.2)]"
                    : "text-petroleum hover:bg-white/60"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          {isAdmin ? (
            <Link
              href="/admin/usuarios"
              className={`rounded-2xl px-3 py-2 text-sm font-medium ${
                pathname.startsWith("/admin")
                  ? "bg-petroleum text-white shadow-[0_10px_24px_rgba(14,74,90,0.2)]"
                  : "text-petroleum hover:bg-white/60"
              }`}
            >
              Perfiles
            </Link>
          ) : null}
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-2xl px-3 py-2 text-sm font-medium text-muted hover:bg-white/60 hover:text-petroleum"
            >
              Salir
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
