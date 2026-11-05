import { AppHeader } from "@/components/layout/app-header";
import { AppNav } from "@/components/layout/app-nav";
import { requerirUsuario } from "@/features/auth/dal";
import { getGalpones } from "@/features/galpones/api";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const [usuario, galpones] = await Promise.all([requerirUsuario(), getGalpones()]);
  const sinAtender = galpones.reduce((n, g) => n + g.alertasSinAtender, 0);

  return (
    // `group/app`: el header (☰) y el menú lateral leen el estado del checkbox con `group-has-[…]`.
    <div className="group/app min-h-screen">
      {/* Abre/cierra el menú en el celular. Invisible pero enfocable: con teclado se usa con la barra espaciadora. */}
      {/* id "menu-lateral" (= ID_MENU_LATERAL de app-nav.tsx; escrito literal porque este es un Server Component). */}
      <input id="menu-lateral" type="checkbox" className="peer sr-only md:hidden" aria-label="Mostrar menú" />
      <AppHeader usuario={usuario} />
      <div className="md:flex">
        <AppNav alertasSinAtender={sinAtender} esAdmin={usuario.rol === "admin"} />
        <main className="mx-auto w-full max-w-[1080px] min-w-0 px-4 pt-8 pb-20 sm:px-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
