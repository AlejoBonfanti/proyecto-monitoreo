"use client";

import { useActionState } from "react";
import { Field } from "@/components/ui/field";
import { MensajeError } from "@/components/ui/mensaje-error";
import { SubmitButton } from "@/components/ui/submit-button";
import type { EstadoGranjaForm } from "../actions";
import type { GranjaAdmin } from "../types";

interface Props {
  accion: (prev: EstadoGranjaForm, formData: FormData) => Promise<EstadoGranjaForm>;
  /** Si viene, es edición. */
  granja?: GranjaAdmin;
}

export function GranjaForm({ accion, granja }: Props) {
  const [estado, enviar] = useActionState(accion, {});
  const e = estado.errores ?? {};
  // Si hubo un error, se muestra lo que se había escrito; si no, los datos guardados.
  const v = estado.valores;

  return (
    <form action={enviar} noValidate className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre" name="nombre" defaultValue={v?.nombre ?? granja?.nombre} required maxLength={100} error={e.nombre} />
        <Field
          label="Ubicación (opcional)"
          name="ubicacion"
          placeholder="Esperanza, Santa Fe"
          defaultValue={v?.ubicacion ?? granja?.ubicacion ?? ""}
          maxLength={200}
          error={e.ubicacion}
        />
      </div>

      <MensajeError>{estado.error}</MensajeError>
      <div>
        <SubmitButton pendiente="Guardando…">{granja ? "Guardar cambios" : "Crear granja"}</SubmitButton>
      </div>
    </form>
  );
}
