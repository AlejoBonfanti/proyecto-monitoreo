export const METRICAS = ["temperatura", "humedad", "co2", "amoniaco"] as const;

export type Metrica = (typeof METRICAS)[number];

/** `null` = el motor de alertas no evalúa (galpón fuera de producción). */
export type Severidad = "ok" | "warning" | "critica";

/** Umbrales de la `regla_alerta` vigente para la edad del lote. */
export interface Umbrales {
  minWarning: number | null;
  maxWarning: number | null;
  minCritico: number | null;
  maxCritico: number | null;
}
