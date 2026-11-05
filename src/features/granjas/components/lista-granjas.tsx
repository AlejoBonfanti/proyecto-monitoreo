import Link from "next/link";
import type { GranjaAdmin } from "../types";

function galponesDe(g: GranjaAdmin): string {
  const activos = g.galpones.filter((x) => x.activo).length;
  const bajas = g.galpones.length - activos;
  if (g.galpones.length === 0) return "Sin galpones";
  return `${activos} galp${activos === 1 ? "ón" : "ones"}${bajas ? ` · ${bajas} de baja` : ""}`;
}

/** Grilla de granjas: cada tarjeta lleva al detalle (galpones con sus gráficos y administración). */
export function ListaGranjas({ granjas }: { granjas: GranjaAdmin[] }) {
  if (granjas.length === 0) {
    return <p className="rounded-md bg-surface-muted px-[18px] py-4 text-[13px] text-ink-muted">Todavía no hay granjas cargadas.</p>;
  }

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {granjas.map((g) => (
        <li key={g.id}>
          <Link
            href={`/granjas/${g.id}`}
            className={`flex h-full flex-col gap-1 rounded-md border border-line bg-surface px-3.5 py-3 hover:border-accent ${g.activo ? "" : "opacity-55"}`}
          >
            <span className="truncate text-[13px] font-semibold">{g.nombre}</span>
            {g.ubicacion && <span className="truncate text-[11.5px] text-ink-muted">{g.ubicacion}</span>}
            <span className="mt-auto pt-1.5 text-[11.5px] text-ink-muted">{galponesDe(g)}</span>
            {!g.activo && <span className="text-[11px] font-medium text-ink-faint">Dada de baja</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}
