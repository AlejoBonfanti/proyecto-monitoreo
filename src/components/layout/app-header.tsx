import { logout } from "@/features/auth/actions";
import type { Usuario } from "@/features/auth/types";
import { BrandMark } from "@/components/ui/brand-mark";
import { Badge } from "@/components/ui/badge";

const ROL: Record<Usuario["rol"], string> = { admin: "Admin", encargado: "Encargado" };

export function AppHeader({ usuario }: { usuario: Usuario }) {
  return (
    <header className="flex items-center justify-between border-b border-line bg-surface px-4 py-3.5 sm:px-7">
      <div className="flex items-center gap-2.5">
        {/* ☰ solo en el celular: es el label del checkbox del menú lateral ((app)/layout.tsx). */}
        <label
          htmlFor="menu-lateral"
          aria-hidden
          className="-ml-1 cursor-pointer rounded px-1.5 py-0.5 text-xl leading-none text-ink-muted hover:text-ink group-has-[#menu-lateral:focus-visible]/app:ring-2 group-has-[#menu-lateral:focus-visible]/app:ring-accent md:hidden"
        >
          ☰
        </label>
        <BrandMark />
        <div className="leading-tight">
          <strong className="block text-sm font-semibold">Grupo CEM</strong>
          <span className="block text-xs text-ink-muted">Monitoreo ambiental</span>
        </div>
      </div>
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="hidden items-center gap-2 text-[12.5px] sm:flex">
          <span className="text-ink">{usuario.nombre}</span>
          <Badge tono="muted">{ROL[usuario.rol]}</Badge>
        </div>
        <form action={logout}>
          <button type="submit" className="text-[12.5px] text-ink-muted hover:text-ink">
            Salir
          </button>
        </form>
      </div>
    </header>
  );
}
