"use client";

import { useActionState } from "react";
import { MensajeError } from "@/components/ui/mensaje-error";
import { SubmitButton } from "@/components/ui/submit-button";
import { agregarGalpon } from "../actions";

const INPUT =
  "w-full rounded-[5px] border border-line bg-surface px-[11px] py-[9px] text-[13.5px] text-ink focus:border-accent focus:shadow-[0_0_0_3px_var(--color-accent-bg)] focus:outline-none";

/** Alta de galpón en la granja. Nace disponible; el estado después lo manejan los lotes. */
export function NuevoGalponForm({ granjaId }: { granjaId: number }) {
  const [estado, enviar] = useActionState(agregarGalpon.bind(null, granjaId), {});

  return (
    <form action={enviar} noValidate className="grid gap-2">
      <label htmlFor="nuevo-galpon" className="text-[12.5px] text-ink-muted">
        Agregar galpón
      </label>
      <div className="flex flex-wrap gap-2">
        {/* Al guardar bien, el form se limpia; si hubo error, se conserva lo escrito. */}
        <input
          id="nuevo-galpon"
          name="nombre"
          placeholder="Galpón 3"
          maxLength={100}
          defaultValue={estado.error ? estado.valor : ""}
          aria-invalid={estado.error ? true : undefined}
          className={`${INPUT} max-w-xs flex-1`}
        />
        <SubmitButton pendiente="Agregando…">Agregar</SubmitButton>
      </div>
      <MensajeError>{estado.error}</MensajeError>
    </form>
  );
}
