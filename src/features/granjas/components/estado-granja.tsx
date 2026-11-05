"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { MensajeError } from "@/components/ui/mensaje-error";
import { SubmitButton } from "@/components/ui/submit-button";
import { cambiarActivoGranja } from "../actions";
import type { GranjaAdmin } from "../types";

/** Dar de baja (con confirmación en línea) o reactivar. Una granja con galpones activos no se puede dar de baja. */
export function EstadoGranja({ granja }: { granja: GranjaAdmin }) {
  const [estado, enviar] = useActionState(cambiarActivoGranja.bind(null, granja.id, !granja.activo), {});
  const [confirmando, setConfirmando] = useState(false);
  const galponesActivos = granja.galpones.filter((g) => g.activo).length;

  if (!granja.activo) {
    return (
      <form action={enviar} className="flex flex-wrap items-center gap-3">
        <span className="text-[13px] text-ink-muted">Esta granja está dada de baja: no se le pueden cargar galpones.</span>
        <SubmitButton variante="secundario" pendiente="Reactivando…">
          Reactivar
        </SubmitButton>
        <MensajeError>{estado.error}</MensajeError>
      </form>
    );
  }

  if (galponesActivos > 0) {
    return (
      <p className="text-[12.5px] text-ink-muted">
        Para dar de baja la granja, primero dá de baja {galponesActivos === 1 ? "su galpón activo" : `sus ${galponesActivos} galpones activos`}.
      </p>
    );
  }

  return (
    <div className="grid gap-2">
      {!confirmando ? (
        <div>
          <Button variante="peligro-borde" onClick={() => setConfirmando(true)}>
            Dar de baja
          </Button>
        </div>
      ) : (
        <form action={enviar} className="flex flex-wrap items-center gap-2 text-[13px]">
          <span className="text-ink-muted">¿Dar de baja {granja.nombre}? Su historial (lotes, lecturas, alertas) se conserva.</span>
          <SubmitButton variante="peligro" pendiente="Dando de baja…">
            Confirmar
          </SubmitButton>
          <Button onClick={() => setConfirmando(false)}>Cancelar</Button>
        </form>
      )}
      <MensajeError>{estado.error}</MensajeError>
    </div>
  );
}
