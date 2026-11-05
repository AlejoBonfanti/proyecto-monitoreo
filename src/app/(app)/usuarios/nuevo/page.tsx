import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requerirRol } from "@/features/auth/dal";
import { crearUsuario } from "@/features/usuarios/actions";
import { getOpcionesGalpones } from "@/features/usuarios/api";
import { UsuarioForm } from "@/features/usuarios/components/usuario-form";

export const metadata: Metadata = { title: "Nuevo usuario" };

export default async function NuevoUsuarioPage() {
  await requerirRol("admin");
  const galpones = await getOpcionesGalpones();

  return (
    <>
      <PageHeader titulo="Nuevo usuario" volver={{ href: "/usuarios", label: "Usuarios" }} />
      <Card>
        <UsuarioForm accion={crearUsuario} galpones={galpones} />
      </Card>
    </>
  );
}
