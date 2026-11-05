import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, CardTitulo } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requerirRol } from "@/features/auth/dal";
import { editarUsuario } from "@/features/usuarios/actions";
import { getOpcionesGalpones, getUsuario } from "@/features/usuarios/api";
import { EstadoUsuario } from "@/features/usuarios/components/estado-usuario";
import { UsuarioForm } from "@/features/usuarios/components/usuario-form";

export const metadata: Metadata = { title: "Editar usuario" };

export default async function EditarUsuarioPage({ params }: PageProps<"/usuarios/[id]">) {
  const yo = await requerirRol("admin");
  const id = Number((await params).id);
  const usuario = Number.isInteger(id) && id > 0 ? await getUsuario(id) : null;
  if (!usuario) notFound();
  const galpones = await getOpcionesGalpones();

  return (
    <>
      <PageHeader titulo={usuario.nombre} subtitulo={usuario.email} volver={{ href: "/usuarios", label: "Usuarios" }} />
      <Card className="mb-4">
        <UsuarioForm accion={editarUsuario.bind(null, usuario.id)} galpones={galpones} usuario={usuario} />
      </Card>
      <Card>
        <CardTitulo>Acceso</CardTitulo>
        <EstadoUsuario usuario={usuario} esYo={usuario.id === yo.id} />
      </Card>
    </>
  );
}
