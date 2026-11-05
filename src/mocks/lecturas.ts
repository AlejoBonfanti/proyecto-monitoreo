/**
 * Genera series históricas determinísticas que terminan en la lectura actual.
 * Reemplaza a la tabla `lectura` / agregado `lectura_1h` mientras no hay backend.
 */
import type { Metrica } from "@/features/metricas/types";
import type { PuntoLectura } from "@/features/galpones/types";

const DERIVA: Record<Metrica, number> = { temperatura: 3, humedad: 1.5, co2: 900, amoniaco: 1.5 };
const RUIDO: Record<Metrica, number> = { temperatura: 0.3, humedad: 2.5, co2: 60, amoniaco: 0.8 };

export function generarSerie(
  metrica: Metrica,
  actual: number,
  desde: Date,
  hasta: Date,
): PuntoLectura[] {
  const horas = Math.max((hasta.getTime() - desde.getTime()) / 3_600_000, 1);
  // Resolución según el rango: 30 min hasta 1 día, 2 h hasta 1 semana, 6 h más allá.
  const pasoHoras = horas <= 24 ? 0.5 : horas <= 24 * 7 ? 2 : 6;
  const n = Math.max(Math.floor(horas / pasoHoras), 2);
  const escala = Math.min(1 + horas / 240, 2);

  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const ruido = Math.sin(i * 1.9 + metrica.length) * RUIDO[metrica] * escala * (1 - t);
    const valor = actual - DERIVA[metrica] * escala * (1 - t) + ruido;
    return {
      ts: new Date(desde.getTime() + t * (hasta.getTime() - desde.getTime())).toISOString(),
      valor: Math.round(valor * 10) / 10,
    };
  });
}
