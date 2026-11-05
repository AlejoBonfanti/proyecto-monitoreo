import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { requerirGalpon } from "@/features/galpones/api";
import { getLotes } from "@/features/lotes/api";
import { HistorialLotes } from "@/features/lotes/components/historial-lotes";
import { LoteActivo } from "@/features/lotes/components/lote-activo";
import { NuevoLote } from "@/features/lotes/components/nuevo-lote";
import { ahora as reloj } from "@/lib/fechas";

export const metadata: Metadata = { title: "Gestión de lote" };

export default async function LotePage({ params }: PageProps<"/galpones/[id]/lote">) {
  const galpon = await requerirGalpon((await params).id);
  const lotes = await getLotes(galpon.id);

  return (
    <>
      <PageHeader
        titulo="Gestión de lote"
        subtitulo={galpon.nombre}
        volver={{ href: `/galpones/${galpon.id}`, label: galpon.nombre }}
      />
      <LoteActivo galpon={galpon} />
      <HistorialLotes lotes={lotes} />
      <NuevoLote galpon={galpon} ahora={reloj()} />
    </>
  );
}
