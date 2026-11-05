import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, CardTitulo } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requerirRol } from "@/features/auth/dal";
import { getGalpones, getLecturas, rangoAFechas } from "@/features/galpones/api";
import type { SerieLecturas } from "@/features/galpones/types";
import { editarGranja } from "@/features/granjas/actions";
import { getGranja } from "@/features/granjas/api";
import { EstadoGranja } from "@/features/granjas/components/estado-granja";
import { GalponGraficos } from "@/features/granjas/components/galpon-graficos";
import { GalponesGranja } from "@/features/granjas/components/galpones-granja";
import { GranjaForm } from "@/features/granjas/components/granja-form";
import { ahora as reloj } from "@/lib/fechas";

export const metadata: Metadata = { title: "Granja" };

export default async function GranjaPage({ params }: PageProps<"/granjas/[id]">) {
  await requerirRol("admin");
  const id = Number((await params).id);
  const granja = Number.isInteger(id) && id > 0 ? await getGranja(id) : null;
  if (!granja) notFound();

  // Galpones activos de esta granja con sus lecturas de las últimas 24 h (solo los que están en producción).
  const ahora = reloj();
  const galpones = (await getGalpones()).filter((g) => g.granja.id === granja.id);
  const series = await Promise.all(
    galpones.map((g): Promise<SerieLecturas[]> => {
      if (g.estadoOperativo !== "produccion") return Promise.resolve([]);
      const { desde, hasta } = rangoAFechas("24h", g, ahora);
      return getLecturas(g.id, desde, hasta);
    }),
  );

  return (
    <>
      <PageHeader titulo={granja.nombre} subtitulo={granja.ubicacion ?? undefined} volver={{ href: "/granjas", label: "Granjas" }} />

      {galpones.length === 0 ? (
        <p className="mb-6 rounded-md bg-surface-muted px-[18px] py-4 text-[13px] text-ink-muted">Esta granja no tiene galpones activos.</p>
      ) : (
        <>
          <p className="mb-2 text-[12px] text-ink-muted">Últimas 24 h</p>
          <div className="mb-8 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {galpones.map((g, i) => (
              <GalponGraficos key={g.id} galpon={g} series={series[i]} />
            ))}
          </div>
        </>
      )}

      {/* Administración de la granja: plegada por defecto. */}
      <details className="group/admin">
        <summary className="mb-3 cursor-pointer list-none text-[13px] font-medium text-accent hover:underline">
          <span className="inline-block transition-transform group-open/admin:rotate-90">▸</span> Administrar granja
        </summary>

        <Card className="mb-4">
          <GranjaForm accion={editarGranja.bind(null, granja.id)} granja={granja} />
        </Card>

        <Card className="mb-4">
          <CardTitulo>Galpones</CardTitulo>
          <GalponesGranja granja={granja} />
        </Card>

        <Card>
          <CardTitulo>Estado</CardTitulo>
          <EstadoGranja granja={granja} />
        </Card>
      </details>
    </>
  );
}
