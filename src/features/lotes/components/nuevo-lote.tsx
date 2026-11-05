import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { marcarLimpiezaTerminada } from "@/features/galpones/actions";
import type { Galpon } from "@/features/galpones/types";
import { hoyISO, sumarDias } from "@/lib/fechas";
import { formatearFecha } from "@/lib/format";
import { NuevoLoteForm } from "./nuevo-lote-form";

/** Duración típica de un ciclo de engorde, para sugerir el fin estimado. */
const DURACION_CICLO_DIAS = 45;

/**
 * Bloque "Crear nuevo lote" según el estado operativo:
 * producción → deshabilitado · disponible → formulario ·
 * limpieza → formulario (cargar el lote termina la limpieza, decisión #33) + opción de
 * marcarla terminada sin cargar lote todavía.
 */
export function NuevoLote({ galpon, ahora }: { galpon: Galpon; ahora: Date }) {
  if (galpon.estadoOperativo === "produccion") {
    return (
      <div className="rounded-md bg-surface-muted px-[18px] py-4 opacity-60">
        <strong className="mb-0.5 block text-[13.5px]">Crear nuevo lote</strong>
        <span className="block text-xs text-ink-muted">El galpón ya tiene un lote en producción. Finalizalo para cargar uno nuevo.</span>
      </div>
    );
  }

  const hoy = hoyISO(ahora);
  const enLimpieza = galpon.estadoOperativo === "limpieza";

  return (
    <Card>
      <strong className="mb-1 block text-[14.5px] font-semibold">Crear nuevo lote</strong>
      {enLimpieza && (
        <p className="mb-4 text-xs text-ink-muted">
          El galpón está en limpieza
          {galpon.limpieza
            ? ` desde el ${formatearFecha(galpon.limpieza.fechaInicio)} (fin estimado ${formatearFecha(galpon.limpieza.fechaFinEstimada)})`
            : ""}
          . Al crear el lote, la limpieza se da por terminada automáticamente.
        </p>
      )}
      <div className={enLimpieza ? "" : "mt-3"}>
        <NuevoLoteForm galponId={galpon.id} sugerido={{ fechaInicio: hoy, fechaFinEstimada: sumarDias(hoy, DURACION_CICLO_DIAS) }} />
      </div>
      {enLimpieza && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <span className="text-xs text-ink-muted">¿Terminó la limpieza pero todavía no ingresan las aves?</span>
          <form action={marcarLimpiezaTerminada.bind(null, galpon.id)}>
            <SubmitButton variante="secundario" tamano="sm" pendiente="Guardando…">
              Marcar limpieza terminada
            </SubmitButton>
          </form>
        </div>
      )}
    </Card>
  );
}
