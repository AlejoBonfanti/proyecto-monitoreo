import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requerirRol } from "@/features/auth/dal";
import { crearGranja } from "@/features/granjas/actions";
import { GranjaForm } from "@/features/granjas/components/granja-form";

export const metadata: Metadata = { title: "Nueva granja" };

export default async function NuevaGranjaPage() {
  await requerirRol("admin");

  return (
    <>
      <PageHeader titulo="Nueva granja" subtitulo="Después de crearla vas a poder cargarle los galpones." volver={{ href: "/granjas", label: "Granjas" }} />
      <Card>
        <GranjaForm accion={crearGranja} />
      </Card>
    </>
  );
}
