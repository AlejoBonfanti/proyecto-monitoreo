/**
 * Lógica que en producción vive en el backend (motor de alertas y reglas de
 * negocio). Está acá solo para que los mocks respondan como la API real.
 * El frontend NUNCA debe importar este archivo.
 */
import type { EstadoNodo } from "@/features/galpones/types";
import type { Metrica, Severidad, Umbrales } from "@/features/metricas/types";
import { diasEntre } from "@/lib/format";
import { hoyISO } from "@/lib/fechas";
import type { LoteRow, MockDb, ReglaAlertaRow } from "./datos";

export function edadDias(lote: Pick<LoteRow, "fechaInicio">, ahora: Date): number {
  return diasEntre(lote.fechaInicio, hoyISO(ahora));
}

/**
 * Regla aplicable: métrica + edad dentro del rango, de LA granja del galpón o global;
 * el override de granja gana sobre la global. Igual que `regla_vigente()` en la base.
 */
export function reglaVigente(
  db: MockDb,
  metrica: Metrica,
  edad: number,
  granjaId: number,
): ReglaAlertaRow | null {
  const candidatas = db.reglas.filter(
    (r) =>
      r.activo &&
      r.metrica === metrica &&
      edad >= r.edadDesde &&
      (r.edadHasta === null || edad < r.edadHasta) &&
      (r.granjaId === null || r.granjaId === granjaId),
  );
  candidatas.sort((a, b) => (a.granjaId === null ? 1 : 0) - (b.granjaId === null ? 1 : 0));
  return candidatas[0] ?? null;
}

export function umbralesDe(r: ReglaAlertaRow): Umbrales {
  return { minWarning: r.minWarning, maxWarning: r.maxWarning, minCritico: r.minCritico, maxCritico: r.maxCritico };
}

/** Alcanzar el umbral ya dispara: ≥ máximo o ≤ mínimo (decisión #28). */
export function evaluarSeveridad(valor: number, u: Umbrales): Severidad {
  if ((u.maxCritico !== null && valor >= u.maxCritico) || (u.minCritico !== null && valor <= u.minCritico))
    return "critica";
  if ((u.maxWarning !== null && valor >= u.maxWarning) || (u.minWarning !== null && valor <= u.minWarning))
    return "warning";
  return "ok";
}

/** Salud del nodo por last-seen: < 5 min online, < 15 min retrasado, si no caído. */
export function estadoNodo(ultimaConexion: string | null, ahora: Date): EstadoNodo {
  if (!ultimaConexion) return "caido";
  const min = (ahora.getTime() - new Date(ultimaConexion).getTime()) / 60_000;
  if (min < 5) return "online";
  if (min < 15) return "retrasado";
  return "caido";
}
