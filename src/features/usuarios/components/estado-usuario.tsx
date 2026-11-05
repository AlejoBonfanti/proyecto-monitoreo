"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { MensajeError } from "@/components/ui/mensaje-error";
import { SubmitButton } from "@/components/ui/submit-button";
import { cambiarActivo } from "../actions";
import type { UsuarioAdmin } from "../types";

/** Dar de baja (con confirmación en línea) o reactivar. */
export function EstadoUsuario({ usuario, esYo }: { usuario: UsuarioAdmin; esYo: boolean }) {
  const [estado, enviar] = useActionState(cambiarActivo.bind(null, usuario.id, !usuario.activo), {});
  const [confirmando, setConfirmando] = useState(false);

  if (esYo) {
    return <p className="text-[12.5px] text-ink-muted">No podés darte de baja a vos mismo.</p>;
  }

  if (!usuario.activo) {
    return (
      <form action={enviar} className="flex flex-wrap items-center gap-3">
        <span className="text-[13px] text-ink-muted">Este usuario está dado de baja y no puede entrar.</span>
        <SubmitButton variante="secundario" pendiente="Reactivando…">
          Reactivar
        </SubmitButton>
        <MensajeError>{estado.error}</MensajeError>
      </form>
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
          <span className="text-ink-muted">
            ¿Dar de baja a {usuario.nombre}? No va a poder entrar. Su historial (lotes, alertas) se conserva.
          </span>
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
