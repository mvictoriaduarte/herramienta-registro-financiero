import type { ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export function GlassCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <section className={`glass-panel rounded-[28px] p-6 ${className}`}>{children}</section>;
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger";
}) {
  const variants = {
    primary:
      "bg-petroleum text-white shadow-[0_12px_30px_rgba(14,74,90,0.22)] hover:-translate-y-0.5 hover:bg-petroleum-deep",
    ghost:
      "bg-white/40 text-petroleum hover:-translate-y-0.5 hover:bg-white/70",
    danger:
      "bg-rose-50/80 text-rose-800 hover:bg-rose-100",
  };

  return (
    <button
      className={`inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

const fieldClass =
  "w-full rounded-2xl border border-white/70 bg-white/50 px-4 py-3 text-sm text-ink outline-none placeholder:text-muted/70 focus:border-petroleum/40 focus:bg-white/80 focus:shadow-[0_0_0_4px_rgba(14,74,90,0.08)]";

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${fieldClass} ${className}`} {...props} />;
}

export function Select({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${fieldClass} ${className}`} {...props} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${fieldClass} min-h-24 resize-none`} {...props} />;
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

export function FormMessage({ state }: { state: { error?: string; success?: string } | null }) {
  if (!state?.error && !state?.success) {
    return null;
  }

  return (
    <p
      className={`rounded-2xl px-4 py-3 text-sm ${
        state.error
          ? "bg-rose-50/80 text-rose-800"
          : "bg-emerald-50/80 text-petroleum"
      }`}
    >
      {state.error ?? state.success}
    </p>
  );
}
