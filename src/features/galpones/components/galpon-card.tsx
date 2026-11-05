import Link from "next/link";
import { META_METRICA, ORDEN_TARJETA } from "@/features/metricas/metricas";
import { formatearFechaCorta, formatearValor, pluralizar } from "@/lib/format";
import type { Galpon } from "../types";
import { EstadoNodo } from "./estado-nodo";
import { EstadoOperativoBadge } from "./estado-operativo-badge";

const FONDO = { ok: "bg-surface-muted", warning: "bg-warn-bg", critica: "bg-danger-bg" } as const;
const TEXTO = { ok: "", warning: "text-warn", critica: "text-danger" } as const;

export function GalponCard({ galpon, ahora }: { galpon: Galpon; ahora: Date }) {
  const enProduccion = galpon.estadoOperativo === "produccion";
  const lote = galpon.loteActivo;

  return (
    <Link
      href={`/galpones/${galpon.id}`}
      className={`block rounded-md border border-line bg-surface px-[18px] py-4 hover:border-accent ${enProduccion ? "" : "opacity-60"}`}
    >
      <div className="mb-2 flex items-center justify-between">
        <strong className="text-[14.5px] font-semibold">{galpon.nombre}</strong>
        <EstadoOperativoBadge estado={galpon.estadoOperativo} />
      </div>
      <p className="mb-3 text-[12.5px] text-ink-muted">
        {lote
          ? `Día ${lote.edadDias} · ${pluralizar(lote.cantidadAvesInicial, "ave")}`
          : galpon.limpieza
            ? `En limpieza desde ${formatearFechaCorta(galpon.limpieza.fechaInicio)} · fin estimado ${formatearFechaCorta(galpon.limpieza.fechaFinEstimada)}`
            : "Sin lote activo"}
      </p>

      {enProduccion && (
        <div className="mb-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {ORDEN_TARJETA.map((metrica) => {
            const lectura = galpon.lecturas.find((l) => l.metrica === metrica);
            const sev = lectura?.severidad ?? "ok";
            return (
              <div key={metrica} className={`rounded-[5px] px-2.5 py-2 ${FONDO[sev]}`}>
                <div className={`text-[10.5px] uppercase tracking-[0.04em] ${TEXTO[sev] || "text-ink-muted"}`}>
                  {META_METRICA[metrica].corto}
                </div>
                <div className={`mt-0.5 font-mono text-[14px] font-semibold ${TEXTO[sev]}`}>
                  {lectura ? formatearValor(metrica, lectura.valor) : "—"}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div
        className={`flex items-center justify-between gap-2 border-t border-line pt-2.5 text-xs text-ink-muted ${enProduccion ? "mt-3" : "mt-11"}`}
      >
        <EstadoNodo nodo={galpon.nodo} ahora={ahora} />
        {!enProduccion ? (
          <span>Sin evaluación ambiental</span>
        ) : galpon.alertasSinAtender > 0 ? (
          <span className="font-semibold text-warn">
            {galpon.alertasSinAtender} alerta{galpon.alertasSinAtender > 1 ? "s" : ""}
          </span>
        ) : (
          <span>Sin alertas</span>
        )}
      </div>
    </Link>
  );
}
