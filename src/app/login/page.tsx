import { LoginForm } from "@/components/LoginForm";
import { GlassCard } from "@/components/ui";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg items-center px-4 py-12">
      <GlassCard className="animate-in w-full p-8 sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-petroleum-soft">
          Acceso privado
        </p>
        <h1 className="mt-3 font-display text-4xl text-petroleum">
          Registro financiero
        </h1>
        <p className="mt-3 mb-8 text-muted">
          Cada perfil ve solo lo suyo. Entrá con el usuario que te asignaron.
        </p>
        <LoginForm />
      </GlassCard>
    </main>
  );
}
