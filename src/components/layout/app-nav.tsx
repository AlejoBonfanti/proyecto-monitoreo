"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * `id` del checkbox (en `(app)/layout.tsx`) que abre/cierra el menú en el celular.
 * El botón ☰ del header es un `<label>` de ese checkbox: abre y cierra sin JavaScript.
 */
export const ID_MENU_LATERAL = "menu-lateral";

/** Cierra el menú del celular (al elegir una opción). En pantallas grandes no tiene efecto. */
function cerrarMenu() {
  const toggle = document.getElementById(ID_MENU_LATERAL) as HTMLInputElement | null;
  if (toggle) toggle.checked = false;
}

export function AppNav({ alertasSinAtender, esAdmin }: { alertasSinAtender: number; esAdmin: boolean }) {
  const pathname = usePathname();
  // Orden: Dashboard → Granjas → Alertas → Usuarios.
  // Granjas y Usuarios: solo se oculta el link; la página y la API también exigen rol admin.
  const items = [
    { href: "/", label: "Dashboard", activo: pathname === "/" || pathname.startsWith("/galpones") },
    ...(esAdmin ? [{ href: "/granjas", label: "Granjas", activo: pathname.startsWith("/granjas") }] : []),
    { href: "/alertas", label: "Alertas", activo: pathname.startsWith("/alertas"), contador: alertasSinAtender },
    ...(esAdmin ? [{ href: "/usuarios", label: "Usuarios", activo: pathname.startsWith("/usuarios") }] : []),
  ];

  return (
    <>
      {/* Fondo oscuro detrás del menú abierto en el celular: tocarlo cierra. */}
      <label
        htmlFor={ID_MENU_LATERAL}
        aria-hidden
        className="fixed inset-0 z-30 hidden bg-ink/30 group-has-[#menu-lateral:checked]/app:block md:!hidden"
      />

      <nav
        aria-label="Principal"
        className="fixed inset-y-0 left-0 z-40 w-64 -translate-x-full border-r border-line bg-surface px-3 pt-4 pb-6 transition-transform group-has-[#menu-lateral:checked]/app:translate-x-0 md:sticky md:top-0 md:z-auto md:h-[calc(100vh-65px)] md:w-[200px] md:shrink-0 md:translate-x-0 md:transition-none"
      >
        <div className="mb-3 flex items-center justify-between px-2 md:hidden">
          <span className="text-xs font-semibold uppercase tracking-[0.03em] text-ink-muted">Menú</span>
          <label htmlFor={ID_MENU_LATERAL} className="cursor-pointer px-1 text-lg leading-none text-ink-muted hover:text-ink" aria-hidden>
            ×
          </label>
        </div>

        <ul className="grid gap-0.5">
          {items.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={cerrarMenu}
                aria-current={item.activo ? "page" : undefined}
                className={`flex items-center justify-between gap-2 rounded-[5px] border-l-2 px-3 py-2.5 text-[13.5px] ${
                  item.activo
                    ? "border-accent bg-accent-bg font-semibold text-accent"
                    : "border-transparent text-ink-muted hover:bg-surface-muted hover:text-ink"
                }`}
              >
                {item.label}
                {item.contador ? (
                  <span className="rounded bg-warn-bg px-1.5 text-[11px] font-semibold text-warn" aria-label={`${item.contador} sin atender`}>
                    {item.contador}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
