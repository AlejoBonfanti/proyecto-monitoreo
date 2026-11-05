import type { GranjaAdmin } from "../types";
import { FilaGalpon } from "./fila-galpon";
import { NuevoGalponForm } from "./nuevo-galpon-form";

/** ABM de los galpones de una granja (decisión #35): alta, renombrar, baja y reactivación. */
export function GalponesGranja({ granja }: { granja: GranjaAdmin }) {
  return (
    <div className="grid gap-4">
      {granja.galpones.length === 0 ? (
        <p className="text-[13px] text-ink-muted">Esta granja todavía no tiene galpones.</p>
      ) : (
        <ul>
          {granja.galpones.map((g) => (
            <FilaGalpon key={g.id} galpon={g} granjaActiva={granja.activo} />
          ))}
        </ul>
      )}
      {granja.activo ? (
        <NuevoGalponForm granjaId={granja.id} />
      ) : (
        <p className="rounded-md bg-surface-muted px-3.5 py-3 text-[12.5px] text-ink-muted">
          La granja está dada de baja: reactivala para agregar o reactivar galpones.
        </p>
      )}
    </div>
  );
}
