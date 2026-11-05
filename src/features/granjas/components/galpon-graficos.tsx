import Link from "next/link";
import { EstadoOperativoBadge } from "@/features/galpones/components/estado-operativo-badge";
import { MetricChart } from "@/features/galpones/components/metric-chart";
import type { Galpon, SerieLecturas } from "@/features/galpones/types";
import { ORDEN_TARJETA } from "@/features/metricas/metricas";

/** Tarjeta de galpón en la vista de granja: 4 mini-gráficos (últimas 24 h) sin tener que abrir el galpón. */
export function GalponGraficos({ galpon, series }: { galpon: Galpon; series: SerieLecturas[] }) {
  const enProduccion = galpon.estadoOperativo === "produccion";

  return (
    <Link
      href={`/galpones/${galpon.id}`}
      className={`block rounded-md border border-line bg-surface px-3 py-2.5 hover:border-accent ${enProduccion ? "" : "opacity-60"}`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <strong className="truncate text-[13px] font-semibold">{galpon.nombre}</strong>
        <div className="flex shrink-0 items-center gap-2">
          {galpon.alertasSinAtender > 0 && (
            <span className="rounded bg-warn-bg px-1.5 text-[11px] font-semibold text-warn">▲ {galpon.alertasSinAtender}</span>
          )}
          <EstadoOperativoBadge estado={galpon.estadoOperativo} />
        </div>
      </div>

      {enProduccion ? (
        <div className="grid grid-cols-2 gap-1.5">
          {ORDEN_TARJETA.map((metrica) => (
            <MetricChart
              key={metrica}
              compacto
              metrica={metrica}
              puntos={series.find((s) => s.metrica === metrica)?.puntos ?? []}
              umbrales={galpon.umbrales[metrica]}
              severidad={galpon.lecturas.find((l) => l.metrica === metrica)?.severidad ?? null}
            />
          ))}
        </div>
      ) : (
        <p className="rounded-[5px] bg-surface-muted px-3 py-6 text-center text-[12px] text-ink-muted">Fuera de producción</p>
      )}
    </Link>
  );
}
