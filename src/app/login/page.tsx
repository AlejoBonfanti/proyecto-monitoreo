import type { Metadata } from "next";
import { BrandMark } from "@/components/ui/brand-mark";
import { LoginForm } from "@/features/auth/components/login-form";
import { usarMocks } from "@/lib/env";
import { PASSWORD_DEMO } from "@/mocks/datos";

export const metadata: Metadata = { title: "Ingresar" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { desde } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-muted px-4">
      <div className="w-full max-w-[320px]">
        <div className="rounded-lg border border-line bg-surface px-7 py-8">
          <div className="mx-auto mb-3 w-fit">
            <BrandMark size="lg" />
          </div>
          <div className="mb-[26px] text-center">
            <h1 className="text-[15px] font-semibold">Grupo CEM</h1>
            <p className="mt-0.5 text-[12.5px] text-ink-muted">Monitoreo ambiental</p>
          </div>
          <LoginForm desde={typeof desde === "string" ? desde : undefined} />
        </div>
        {usarMocks() && (
          <p className="mt-4 text-center text-xs leading-relaxed text-ink-muted">
            Modo demo (sin backend): <span className="font-mono">admin@carnave.com</span> o{" "}
            <span className="font-mono">encargado@carnave.com</span>, contraseña{" "}
            <span className="font-mono">{PASSWORD_DEMO}</span>
          </p>
        )}
      </div>
    </main>
  );
}
