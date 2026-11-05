import { SubmitButton } from "@/components/ui/submit-button";
import { reconocerAlerta, resolverAlerta } from "../actions";
import type { Alerta } from "../types";
import { sinAtender } from "../utils";

export function AccionesAlerta({ alerta }: { alerta: Alerta }) {
  if (alerta.estado === "resuelta") return null;
  return (
    <div className="flex gap-2">
      {sinAtender(alerta) && (
        <form action={reconocerAlerta.bind(null, alerta.id)}>
          <SubmitButton variante="secundario" tamano="sm" pendiente="Reconociendo…">
            Reconocer
          </SubmitButton>
        </form>
      )}
      <form action={resolverAlerta.bind(null, alerta.id)}>
        <SubmitButton variante="secundario" tamano="sm" pendiente="Resolviendo…">
          Resolver
        </SubmitButton>
      </form>
    </div>
  );
}
