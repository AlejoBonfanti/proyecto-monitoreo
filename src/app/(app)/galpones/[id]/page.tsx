import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { getLecturas, rangoAFechas, requerirGalpon } from "@/features/galpones/api";
import { EstadoNodo } from "@/features/galpones/components/estado-nodo";
import { MetricChart } from "@/features/galpones/components/metric-chart";
import { SelectorRango } from "@/features/galpones/components/selector-rango";
import type { RangoLecturas } from "@/features/galpones/types";
import { ORDEN_GRAFICOS } from "@/features/metricas/metricas";
import { diasEntre, formatearFechaCorta, pluralizar } from "@/lib/format";
import { ahora as reloj } from "@/lib/fechas";

export async function generateMetadata({ params }: PageProps<"/galpones/[id]">): Promise<Metadata> {
  const galpon = await requerirGalpon((await params).id);
  return { title: galpon.nombre };
}

function parsearRango(valor: string | string[] | undefined, conLote: boolean): RangoLecturas {
  if (valor === "7d") return "7d";
  if (valor === "lote" && conLote) return "lote";
  return "24h";
}

export default async function GalponPage({ params, searchParams }: PageProps<"/galpones/[id]">) {
  const galpon = await requerirGalpon((await params).id);
  const ahora = reloj();
  const lote = galpon.loteActivo;
  const enProduccion = galpon.estadoOperativo === "produccion";
  const rango = parsearRango((await searchParams).rango, lote !== null);

  const subtitulo = lote
    ? `Lote iniciado ${formatearFechaCorta(lote.fechaInicio)} · Día ${lote.edadDias} de ${diasEntre(lote.fechaInicio, lote.fechaFinEstimada)} · ${pluralizar(lote.cantidadAvesInicial, "ave")}`
    : "Sin lote activo";

  let graficos: React.ReactNode = (
    <div className="rounded-md bg-surface-muted px-[18px] py-4 text-[13px] text-ink-muted">
      Galpón fuera de producción: el motor de alertas está pausado y no hay evaluación ambiental.
    </div>
  );
  if (enProduccion) {
    const { desde, hasta } = rangoAFechas(rango, galpon, ahora);
    const series = await getLecturas(galpon.id, desde, hasta);
    graficos = (
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        {ORDEN_GRAFICOS.map((metrica) => (
          <MetricChart
            key={metrica}
            metrica={metrica}
            puntos={series.find((s) => s.metrica === metrica)?.puntos ?? []}
            umbrales={galpon.umbrales[metrica]}
            severidad={galpon.lecturas.find((l) => l.metrica === metrica)?.severidad ?? null}
          />
        ))}
      </div>
    );
  }

  return (
    <>
      <PageHeader
        titulo={galpon.nombre}
        subtitulo={subtitulo}
        acciones={enProduccion ? <SelectorRango valor={rango} conLote={lote !== null} /> : undefined}
      />
      {graficos}

      <div className="mt-3.5 flex flex-col gap-3 text-[12.5px] sm:flex-row">
        <div className="flex flex-1 items-center rounded-md bg-surface-muted px-3.5 py-3 text-ink-muted">
          <EstadoNodo nodo={galpon.nodo} ahora={ahora} detallado />
        </div>
        {galpon.alertasSinAtender > 0 ? (
          <Link
            href="/alertas"
            className="flex flex-1 items-center gap-2 rounded-md bg-warn-bg px-3.5 py-3 font-semibold text-warn hover:underline"
          >
            ▲ {galpon.alertasSinAtender} alerta{galpon.alertasSinAtender > 1 ? "s" : ""} sin atender — ver alertas
          </Link>
        ) : (
          <div className="flex flex-1 items-center rounded-md bg-surface-muted px-3.5 py-3 text-ink-muted">
            Sin alertas sin atender
          </div>
        )}
      </div>

      <div className="mt-5">
        <Link href={`/galpones/${galpon.id}/lote`} className="text-[13px] font-medium text-accent hover:underline">
          Gestión de lote →
        </Link>
      </div>
    </>
  );
}
