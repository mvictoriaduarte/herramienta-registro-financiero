"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { deleteIncomeSourceAction } from "@/actions/income";
import { DeleteButton } from "@/components/DeleteButton";
import { IncomeSourceSettingsForm } from "@/components/IncomeForms";
import { SourceAvatar } from "@/components/SourceAvatar";
import { BILLING_MODE_LABELS, type BillingMode } from "@/lib/types";

export function SourceHeader({
  source,
  bnaSell = null,
}: {
  source: {
    id: string;
    name: string;
    color: string;
    logoUrl?: string | null;
    billingMode: string;
    defaultFxRate: number | null;
  };
  bnaSell?: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const mode = source.billingMode as BillingMode;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const modal =
    open && mounted
      ? createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <button
              type="button"
              className="absolute inset-0 bg-petroleum-deep/35 backdrop-blur-sm"
              aria-label="Cerrar"
              onClick={() => setOpen(false)}
            />
            <div className="glass-panel relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[28px] p-6 shadow-2xl sm:p-8">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-petroleum-soft">
                    Configuración
                  </p>
                  <h2 className="mt-2 font-display text-3xl text-petroleum">{source.name}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-full px-3 py-1 text-sm text-muted hover:bg-white/60 hover:text-petroleum"
                >
                  Cerrar
                </button>
              </div>

              <IncomeSourceSettingsForm
                source={source}
                bnaSell={bnaSell}
                onSaved={() => setOpen(false)}
              />

              <div className="mt-6 border-t border-white/50 pt-6">
                <p className="mb-3 text-sm text-muted">
                  Borrar la fuente elimina también todos sus períodos y adicionales.
                </p>
                <DeleteButton
                  action={deleteIncomeSourceAction}
                  id={source.id}
                  label="Eliminar fuente"
                />
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div className="animate-in space-y-4">
        <Link
          href="/ingresos"
          aria-label="Volver a ingresos"
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

        <div className="flex items-center gap-4">
          <SourceAvatar
            name={source.name}
            color={source.color}
            logoUrl={source.logoUrl}
            size="lg"
          />

          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-petroleum-soft">
              {BILLING_MODE_LABELS[mode] ?? source.billingMode}
            </p>
            <h1 className="truncate font-display text-3xl text-petroleum sm:text-4xl">
              {source.name}
            </h1>
          </div>

          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Configuración de la fuente"
            className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-transparent transition hover:opacity-80"
            style={{ color: source.color }}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-7 w-7"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.07 7.07 0 0 0-1.63-.94l-.36-2.54A.5.5 0 0 0 13.9 2h-3.8a.5.5 0 0 0-.49.42l-.36 2.54c-.59.24-1.13.55-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.71 8.48a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.14.24.43.34.68.22l2.39-.96c.5.39 1.04.7 1.63.94l.36 2.54c.05.24.25.42.49.42h3.8c.24 0 .44-.18.49-.42l.36-2.54c.59-.24 1.13-.55 1.63-.94l2.39.96c.25.12.54.02.68-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z" />
            </svg>
          </button>
        </div>
      </div>
      {modal}
    </>
  );
}
