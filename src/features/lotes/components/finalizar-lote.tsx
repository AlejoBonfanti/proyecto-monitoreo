"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { finalizarLote } from "../actions";

/** Confirmación en línea (sin `window.confirm`) antes de finalizar. */
export function FinalizarLote({ loteId }: { loteId: number }) {
  const [confirmando, setConfirmando] = useState(false);

  if (!confirmando) {
    return (
      <Button variante="peligro-borde" onClick={() => setConfirmando(true)}>
        Finalizar lote
      </Button>
    );
  }

  return (
    <form action={finalizarLote.bind(null, loteId)} className="flex flex-wrap items-center gap-2 text-[13px]">
      <span className="text-ink-muted">¿Finalizar el lote activo? El galpón pasa a limpieza.</span>
      <SubmitButton variante="peligro" pendiente="Finalizando…">
        Confirmar
      </SubmitButton>
      <Button onClick={() => setConfirmando(false)}>Cancelar</Button>
    </form>
  );
}
