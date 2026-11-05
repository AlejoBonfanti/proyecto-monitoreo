/**
 * Formateo de presentación. Única fuente para mostrar valores, fechas y
 * tiempos relativos: si algo se muestra distinto en dos pantallas, se corrige acá.
 */
import { META_METRICA } from "@/features/metricas/metricas";
import type { Metrica } from "@/features/metricas/types";
import { fechaAR } from "./fechas";

const numero = new Intl.NumberFormat("es-AR");

/** 12400 → "12.400" */
export function formatearNumero(n: number): string {
  return numero.format(n);
}

/** Valor de una métrica con su unidad: "27.4 °C", "61 %", "2850 ppm". */
export function formatearValor(metrica: Metrica, valor: number): string {
  const { unidad, decimales } = META_METRICA[metrica];
  return `${valor.toFixed(decimales)} ${unidad}`;
}

/**
 * Fecha ISO → "24/08/2026". Un día (yyyy-mm-dd) se muestra tal cual; un
 * timestamp se pasa primero a hora argentina (01:30 UTC del 25 es el 24 acá).
 */
export function formatearFecha(iso: string): string {
  const dia = iso.length > 10 ? fechaAR(new Date(iso)) : iso;
  const [y, m, d] = dia.split("-");
  return `${d}/${m}/${y}`;
}

/** Fecha ISO → "24/08". */
export function formatearFechaCorta(iso: string): string {
  return formatearFecha(iso).slice(0, 5);
}

/** Días enteros entre dos fechas ISO (yyyy-mm-dd), en UTC para evitar corrimientos por huso. */
export function diasEntre(desde: string, hasta: string): number {
  const a = Date.UTC(+desde.slice(0, 4), +desde.slice(5, 7) - 1, +desde.slice(8, 10));
  const b = Date.UTC(+hasta.slice(0, 4), +hasta.slice(5, 7) - 1, +hasta.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

/** Timestamp ISO → "hace 6 min", "hace 2 h", "hace 3 días". `ahora` se pasa explícito para que sea testeable y estable entre servidor y cliente. */
export function tiempoRelativo(iso: string, ahora: Date): string {
  const min = Math.floor((ahora.getTime() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} día${d === 1 ? "" : "s"}`;
}

/** "Esteban Martínez" → "E. Martínez" */
export function nombreCorto(nombre: string): string {
  const partes = nombre.trim().split(/\s+/);
  if (partes.length < 2) return nombre;
  return `${partes[0][0]}. ${partes.slice(1).join(" ")}`;
}

/** "1" → "1 ave", 12400 → "12.400 aves" */
export function pluralizar(n: number, singular: string, plural = `${singular}s`): string {
  return `${formatearNumero(n)} ${n === 1 ? singular : plural}`;
}
