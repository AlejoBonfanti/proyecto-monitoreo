/**
 * Reloj de la aplicación y fechas de negocio. Centralizado para que los
 * componentes no llamen a `new Date()` sueltos (dificulta tests y puede
 * desincronizar servidor/cliente).
 *
 * Todo lo que es "un día" (hoy, edad del lote, inicio de lote) se calcula en
 * hora argentina, sin importar la zona del servidor (la nube suele estar en UTC).
 * Es la misma regla que `hoy_ar()` en la base (docs/sql/001_esquema.sql).
 */
export const ZONA_HORARIA = "America/Argentina/Buenos_Aires";

const partesFecha = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA_HORARIA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function ahora(): Date {
  return new Date();
}

/** Día (yyyy-mm-dd) en Argentina correspondiente a un instante. */
export function fechaAR(instante: Date): string {
  const p = Object.fromEntries(partesFecha.formatToParts(instante).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

/** Fecha de hoy en Argentina, formato yyyy-mm-dd. */
export function hoyISO(instante: Date = ahora()): string {
  return fechaAR(instante);
}

/** Suma días a una fecha yyyy-mm-dd. */
export function sumarDias(iso: string, dias: number): string {
  const f = new Date(`${iso}T12:00:00Z`);
  f.setUTCDate(f.getUTCDate() + dias);
  return f.toISOString().slice(0, 10);
}

/** Instante en que empieza el día `iso` (00:00) en Argentina. */
export function inicioDelDia(iso: string): Date {
  // Se parte de medianoche UTC y se corrige por el offset real de la zona ese día
  // (hoy es -03:00 fijo, pero así no depende de que Argentina no vuelva a usar horario de verano).
  const utc = new Date(`${iso}T00:00:00Z`);
  const offsetMin = offsetZonaMin(utc);
  return new Date(utc.getTime() - offsetMin * 60_000);
}

/** Offset de la zona respecto de UTC, en minutos (Argentina: -180). */
function offsetZonaMin(instante: Date): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: ZONA_HORARIA,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    })
      .formatToParts(instante)
      .map((x) => [x.type, Number(x.value)]),
  );
  const comoUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((comoUTC - instante.getTime()) / 60_000);
}
