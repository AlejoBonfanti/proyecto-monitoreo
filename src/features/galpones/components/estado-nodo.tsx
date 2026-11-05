import { tiempoRelativo } from "@/lib/format";
import type { Galpon } from "../types";

const TEXTO = { online: "Nodo activo", retrasado: "Nodo con dato retrasado", caido: "Nodo caído" } as const;
const COLOR = { online: "text-accent", retrasado: "text-warn", caido: "text-danger" } as const;

export function EstadoNodo({ nodo, ahora, detallado = false }: { nodo: Galpon["nodo"]; ahora: Date; detallado?: boolean }) {
  const cuando = nodo.ultimaConexion ? tiempoRelativo(nodo.ultimaConexion, ahora) : "sin conexiones";
  return (
    <span className={nodo.estado === "online" ? "" : `font-semibold ${COLOR[nodo.estado]}`}>
      <span className={COLOR[nodo.estado]} aria-hidden>
        ●
      </span>{" "}
      {TEXTO[nodo.estado]} {detallado ? `— última conexión ${cuando}` : cuando}
    </span>
  );
}
