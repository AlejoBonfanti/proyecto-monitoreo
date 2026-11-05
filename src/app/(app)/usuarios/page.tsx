import type { Metadata } from "next";
import Link from "next/link";
import { claseBoton } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { requerirRol } from "@/features/auth/dal";
import { getUsuarios } from "@/features/usuarios/api";
import { ListaUsuarios } from "@/features/usuarios/components/lista-usuarios";

export const metadata: Metadata = { title: "Usuarios" };

export default async function UsuariosPage() {
  const yo = await requerirRol("admin");
  const usuarios = await getUsuarios();
  const activos = usuarios.filter((u) => u.activo).length;

  return (
    <>
      <PageHeader
        titulo="Usuarios"
        subtitulo={`${activos} activo${activos === 1 ? "" : "s"}${usuarios.length > activos ? ` · ${usuarios.length - activos} dado${usuarios.length - activos === 1 ? "" : "s"} de baja` : ""}`}
        acciones={
          <Link href="/usuarios/nuevo" className={claseBoton("primario")}>
            Nuevo usuario
          </Link>
        }
      />
      <ListaUsuarios usuarios={usuarios} yo={yo.id} />
    </>
  );
}
