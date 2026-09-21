"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

const CreatePlusModalContext = createContext<{ close: () => void } | null>(null);

export function useCreatePlusClose() {
  return useContext(CreatePlusModalContext)?.close;
}

export function CreatePlusModal({
  title,
  ariaLabel = "Agregar",
  size = "md",
  trigger,
  children,
}: {
  title: string;
  ariaLabel?: string;
  size?: "sm" | "md" | "lg";
  trigger?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

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

  const close = () => setOpen(false);
  const buttonClass =
    size === "sm"
      ? "flex h-9 w-9 items-center justify-center rounded-full bg-petroleum/90 text-xl font-light leading-none text-white transition hover:bg-petroleum-deep"
      : "flex h-11 w-11 items-center justify-center rounded-full bg-petroleum text-2xl font-light leading-none text-white shadow-[0_12px_28px_rgba(14,74,90,0.28)] transition duration-500 hover:-translate-y-0.5 hover:bg-petroleum-deep";
  const panelWidth = size === "lg" ? "max-w-2xl" : "max-w-lg";

  const modal =
    open && mounted
      ? createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <button
              type="button"
              className="absolute inset-0 bg-petroleum-deep/35 backdrop-blur-sm"
              aria-label="Cerrar"
              onClick={close}
            />
            <div
              className={`glass-panel relative z-10 max-h-[90vh] w-full ${panelWidth} overflow-y-auto rounded-[28px] p-6 shadow-2xl sm:p-8`}
            >
              <div className="mb-6 flex items-start justify-between gap-4">
                <h2 className="font-display text-3xl text-petroleum">{title}</h2>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Cerrar"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-white/60 hover:text-petroleum"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>
              <CreatePlusModalContext.Provider value={{ close }}>
                {children}
              </CreatePlusModalContext.Provider>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          trigger
            ? "inline-flex h-9 w-9 items-center justify-center rounded-full text-petroleum transition hover:bg-white/70"
            : buttonClass
        }
        aria-label={ariaLabel}
      >
        {trigger ?? "+"}
      </button>
      {modal}
    </>
  );
}
