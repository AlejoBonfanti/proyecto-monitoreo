import type { Metadata } from "next";
import Link from "next/link";
import { claseBoton } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { requerirRol } from "@/features/auth/dal";
import { getGranjas } from "@/features/granjas/api";
import { ListaGranjas } from "@/features/granjas/components/lista-granjas";

export const metadata: Metadata = { title: "Granjas" };

export default async function GranjasPage() {
  await requerirRol("admin");
  const granjas = await getGranjas();
  const activas = granjas.filter((g) => g.activo).length;
  const bajas = granjas.length - activas;

  return (
    <>
      <PageHeader
        titulo="Granjas"
        subtitulo={`${activas} activa${activas === 1 ? "" : "s"}${bajas ? ` · ${bajas} dada${bajas === 1 ? "" : "s"} de baja` : ""}`}
        acciones={
          <Link href="/granjas/nueva" className={claseBoton("primario")}>
            Nueva granja
          </Link>
        }
      />
      <ListaGranjas granjas={granjas} />
    </>
  );
}
