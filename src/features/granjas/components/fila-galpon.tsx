"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { MensajeError } from "@/components/ui/mensaje-error";
import { SubmitButton } from "@/components/ui/submit-button";
import { EstadoOperativoBadge } from "@/features/galpones/components/estado-operativo-badge";
import { cambiarActivoGalpon, renombrarGalpon } from "../actions";
import type { GalponAdmin } from "../types";

const INPUT =
  "w-full rounded-[5px] border border-line bg-surface px-[11px] py-[7px] text-[13.5px] text-ink focus:border-accent focus:shadow-[0_0_0_3px_var(--color-accent-bg)] focus:outline-none";

type Modo = "ver" | "renombrando" | "confirmando-baja";

/** Un galpón de la granja: renombrar, dar de baja (con confirmación) o reactivar. */
export function FilaGalpon({ galpon, granjaActiva }: { galpon: GalponAdmin; granjaActiva: boolean }) {
  const [renombre, renombrar] = useActionState(renombrarGalpon.bind(null, galpon.id), {});
  const [cambioActivo, cambiarActivo] = useActionState(cambiarActivoGalpon.bind(null, galpon.id, !galpon.activo), {});
  // Guarda el `ok` vigente al abrir un modo: cuando la acción termina bien, `ok` cambia y se vuelve a "ver".
  const [modo, setModo] = useState<{ tipo: Modo; okAlAbrir?: number }>({ tipo: "ver" });
  const tipo =
    (modo.tipo === "renombrando" && renombre.ok !== modo.okAlAbrir) ||
    (modo.tipo === "confirmando-baja" && cambioActivo.ok !== modo.okAlAbrir)
      ? "ver"
      : modo.tipo;
  const enProduccion = galpon.estadoOperativo === "produccion";

  if (tipo === "renombrando") {
    return (
      <li className="grid gap-2 border-b border-line py-3 last:border-b-0">
        <form action={renombrar} noValidate className="flex flex-wrap items-center gap-2">
          <input
            name="nombre"
            aria-label={`Nuevo nombre para ${galpon.nombre}`}
            defaultValue={renombre.error ? renombre.valor : galpon.nombre}
            maxLength={100}
            autoFocus
            className={`${INPUT} max-w-xs flex-1`}
          />
          <SubmitButton tamano="sm" pendiente="Guardando…">
            Guardar
          </SubmitButton>
          <Button tamano="sm" onClick={() => setModo({ tipo: "ver" })}>
            Cancelar
          </Button>
        </form>
        <MensajeError>{renombre.error}</MensajeError>
      </li>
    );
  }

  return (
    <li className="grid gap-2 border-b border-line py-3 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-3 text-[13px]">
        <div className={`flex items-center gap-3 ${galpon.activo ? "" : "opacity-55"}`}>
          {galpon.activo ? (
            <Link href={`/galpones/${galpon.id}`} className="font-medium hover:underline">
              {galpon.nombre}
            </Link>
          ) : (
            <span className="font-medium">{galpon.nombre}</span>
          )}
          {galpon.activo ? <EstadoOperativoBadge estado={galpon.estadoOperativo} /> : <span className="text-ink-muted">Dado de baja</span>}
        </div>

        {tipo === "confirmando-baja" ? (
          <form action={cambiarActivo} className="flex flex-wrap items-center gap-2">
            <span className="text-ink-muted">¿Dar de baja {galpon.nombre}? Se conserva su historial.</span>
            <SubmitButton tamano="sm" variante="peligro" pendiente="Dando de baja…">
              Confirmar
            </SubmitButton>
            <Button tamano="sm" onClick={() => setModo({ tipo: "ver" })}>
              Cancelar
            </Button>
          </form>
        ) : galpon.activo ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button tamano="sm" onClick={() => setModo({ tipo: "renombrando", okAlAbrir: renombre.ok })}>
              Renombrar
            </Button>
            <Button
              tamano="sm"
              variante="peligro-borde"
              disabled={enProduccion}
              title={enProduccion ? "En producción: finalizá el lote para poder darlo de baja." : undefined}
              onClick={() => setModo({ tipo: "confirmando-baja", okAlAbrir: cambioActivo.ok })}
            >
              Dar de baja
            </Button>
          </div>
        ) : (
          granjaActiva && (
            <form action={cambiarActivo}>
              <SubmitButton tamano="sm" variante="secundario" pendiente="Reactivando…">
                Reactivar
              </SubmitButton>
            </form>
          )
        )}
      </div>
      {enProduccion && galpon.activo && tipo === "ver" && (
        <p className="text-xs text-ink-faint">En producción: para darlo de baja, primero finalizá el lote.</p>
      )}
      <MensajeError>{cambioActivo.error}</MensajeError>
    </li>
  );
}
