"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { IconTrash, iconButtonClass } from "@/components/ActionIcons";
import { Button } from "@/components/ui";

type DeleteResult = void | { error?: string; success?: string } | null;

export function DeleteButton({
  action,
  id,
  label = "Borrar",
  icon = false,
  confirmTitle,
  confirmMessage,
}: {
  action: (formData: FormData) => DeleteResult | Promise<DeleteResult>;
  id: string;
  label?: string;
  icon?: boolean;
  confirmTitle?: string;
  confirmMessage?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const title = confirmTitle ?? "Confirmar eliminación";
  const message =
    confirmMessage ?? `¿Estás seguro/a de querer eliminar ${label.toLowerCase()}?`;

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

  function openConfirm() {
    setError(null);
    setOpen(true);
  }

  function confirmDelete() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", id);
      const result = await action(formData);
      if (result && typeof result === "object" && result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  const modal =
    open && mounted
      ? createPortal(
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <button
              type="button"
              className="absolute inset-0 bg-petroleum-deep/35 backdrop-blur-sm"
              aria-label="Cerrar"
              onClick={() => setOpen(false)}
            />
            <div className="glass-panel relative z-10 w-full max-w-md rounded-[28px] p-6 shadow-2xl sm:p-8">
              <h2 className="font-display text-3xl text-petroleum">{title}</h2>
              <p className="mt-3 text-sm text-muted">{message}</p>
              {error ? (
                <p className="mt-4 rounded-2xl bg-rose-50/80 px-4 py-3 text-sm text-rose-800">
                  {error}
                </p>
              ) : null}
              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => setOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  disabled={pending}
                  onClick={confirmDelete}
                >
                  {pending ? "Eliminando..." : "Sí, eliminar"}
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {icon ? (
        <button
          type="button"
          aria-label={label}
          onClick={openConfirm}
          className={`${iconButtonClass} text-rose-700 hover:bg-rose-50/80`}
        >
          <IconTrash />
        </button>
      ) : (
        <button
          type="button"
          onClick={openConfirm}
          className="inline-flex items-center justify-center rounded-2xl bg-rose-50/80 px-3 py-2 text-xs font-semibold text-rose-800 hover:bg-rose-100"
        >
          {label}
        </button>
      )}
      {modal}
    </>
  );
}
