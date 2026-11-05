"use client";

import { useActionState } from "react";
import { Field } from "@/components/ui/field";
import { MensajeError } from "@/components/ui/mensaje-error";
import { SubmitButton } from "@/components/ui/submit-button";
import { crearLote, type EstadoNuevoLote } from "../actions";

interface Props {
  galponId: number;
  /** Valores sugeridos (hoy y hoy + duración típica del ciclo). Hoy es también el máximo de la fecha de inicio. */
  sugerido: { fechaInicio: string; fechaFinEstimada: string };
}

export function NuevoLoteForm({ galponId, sugerido }: Props) {
  const [estado, accion] = useActionState<EstadoNuevoLote, FormData>(crearLote.bind(null, galponId), {});
  const e = estado.errores ?? {};

  return (
    <form action={accion} noValidate className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Número de lote (opcional)" name="numero" maxLength={20} placeholder="Ej: 14" error={e.numero} />
        <Field
          label="Cantidad de aves"
          name="cantidadAvesInicial"
          type="number"
          inputMode="numeric"
          min={1}
          required
          error={e.cantidadAvesInicial}
        />
        <Field
          label="Fecha de inicio"
          name="fechaInicio"
          type="date"
          defaultValue={sugerido.fechaInicio}
          max={sugerido.fechaInicio}
          required
          error={e.fechaInicio}
        />
        <Field
          label="Fin estimado"
          name="fechaFinEstimada"
          type="date"
          defaultValue={sugerido.fechaFinEstimada}
          required
          error={e.fechaFinEstimada}
        />
      </div>
      <MensajeError>{estado.error}</MensajeError>
      <div>
        <SubmitButton pendiente="Creando…">Crear lote</SubmitButton>
      </div>
    </form>
  );
}
