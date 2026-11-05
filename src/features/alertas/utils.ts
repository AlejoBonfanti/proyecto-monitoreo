import { META_METRICA } from "@/features/metricas/metricas";
import type { Alerta } from "./types";

/** Requiere atención: nadie la reconoció todavía. */
export function sinAtender(a: Pick<Alerta, "estado">): boolean {
  return a.estado === "activa" || a.estado === "escalada";
}

/** Orden de la lista: sin atender primero, críticas antes que warnings, más recientes arriba. */
export function ordenarAlertas<T extends Pick<Alerta, "estado" | "severidad" | "fechaDisparo">>(alertas: T[]): T[] {
  return [...alertas].sort(
    (a, b) =>
      Number(sinAtender(b)) - Number(sinAtender(a)) ||
      Number(b.severidad === "critica") - Number(a.severidad === "critica") ||
      b.fechaDisparo.localeCompare(a.fechaDisparo),
  );
}

/** "Galpón 1 · CO2", "Galpón 1 · Nodo sin conexión", "Galpón 1 · Sin datos de CO2". */
export function tituloAlerta(a: Pick<Alerta, "tipo" | "galpon" | "metrica">): string {
  const que =
    a.tipo === "nodo_caido"
      ? "Nodo sin conexión"
      : a.tipo === "dato_retrasado"
        ? `Sin datos de ${a.metrica ? META_METRICA[a.metrica].nombre : "un sensor"}`
        : a.metrica
          ? META_METRICA[a.metrica].nombre
          : "Alerta";
  return `${a.galpon.nombre} · ${que}`;
}
