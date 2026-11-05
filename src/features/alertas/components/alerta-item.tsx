import { Badge } from "@/components/ui/badge";
import { formatearValor, nombreCorto, tiempoRelativo } from "@/lib/format";
import type { Alerta, EstadoAlerta } from "../types";
import { sinAtender, tituloAlerta } from "../utils";
import { AccionesAlerta } from "./acciones-alerta";

const ESTADO: Record<EstadoAlerta, string> = {
  activa: "Activa",
  reconocida: "Reconocida",
  escalada: "Escalada",
  resuelta: "Resuelta",
};

/** Qué se muestra en lugar del valor: el valor leído (ambiental) o qué pasó con el equipo. */
function queMostrar(a: Alerta): string {
  if (a.tipo === "ambiental" && a.metrica && a.valorLeido !== null) return formatearValor(a.metrica, a.valorLeido);
  return a.tipo === "nodo_caido" ? "el ESP32 no reporta" : "el sensor no envía lecturas";
}

function detalle(a: Alerta, ahora: Date): string {
  const valor = queMostrar(a);
  if (a.estado === "resuelta" && a.fechaResolucion) {
    const quien = a.resolucionAutomatica ? "automáticamente" : a.resueltaPor ? `por ${nombreCorto(a.resueltaPor.nombre)}` : "";
    return `${valor} · resuelta ${quien} ${tiempoRelativo(a.fechaResolucion, ahora)}`.replace(/\s+/g, " ");
  }
  if (a.estado === "reconocida" && a.fechaReconocimiento) {
    const quien = a.reconocidaPor ? `por ${nombreCorto(a.reconocidaPor.nombre)} ` : "";
    return `${valor} · reconocida ${quien}${tiempoRelativo(a.fechaReconocimiento, ahora)}`;
  }
  return `${valor} · disparada ${tiempoRelativo(a.fechaDisparo, ahora)}`;
}

export function AlertaItem({ alerta, ahora }: { alerta: Alerta; ahora: Date }) {
  const atendida = !sinAtender(alerta);
  const borde = atendida ? "border-l-line" : alerta.severidad === "critica" ? "border-l-danger" : "border-l-warn";
  const tono = atendida ? "muted" : alerta.severidad === "critica" ? "danger" : "warn";

  return (
    <li
      className={`flex flex-col gap-3 rounded-md border border-l-[3px] border-line bg-surface px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between ${borde} ${
        alerta.estado === "resuelta" ? "opacity-55" : atendida ? "opacity-70" : ""
      }`}
    >
      <div>
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <Badge tono={tono}>{alerta.severidad === "critica" ? "Crítica" : "Warning"}</Badge>
          <Badge tono="muted">{ESTADO[alerta.estado]}</Badge>
          <span className="text-[13.5px] font-semibold">{tituloAlerta(alerta)}</span>
        </div>
        <div className="font-mono text-xs text-ink-muted">{detalle(alerta, ahora)}</div>
      </div>
      <AccionesAlerta alerta={alerta} />
    </li>
  );
}
