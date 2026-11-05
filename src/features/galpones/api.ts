import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import { api, ApiError } from "@/lib/api-client";
import { inicioDelDia } from "@/lib/fechas";
import type { Galpon, RangoLecturas, SerieLecturas } from "./types";

export function getGalpones(): Promise<Galpon[]> {
  return api<Galpon[]>("/galpones");
}

/** `null` si no existe o el usuario no lo tiene asignado. Cacheado por request. */
export const getGalpon = cache(async (id: number): Promise<Galpon | null> => {
  try {
    return await api<Galpon>(`/galpones/${id}`);
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 403)) return null;
    throw e;
  }
});

/** Para páginas con `[id]`: valida el parámetro y responde 404 si no hay acceso. */
export async function requerirGalpon(idParam: string): Promise<Galpon> {
  const id = Number(idParam);
  const galpon = Number.isInteger(id) && id > 0 ? await getGalpon(id) : null;
  if (!galpon) notFound();
  return galpon;
}

/** Traduce el rango elegido en la UI a `desde`/`hasta` para la API. */
export function rangoAFechas(rango: RangoLecturas, galpon: Galpon, ahora: Date): { desde: Date; hasta: Date } {
  const hasta = ahora;
  if (rango === "lote" && galpon.loteActivo) {
    return { desde: inicioDelDia(galpon.loteActivo.fechaInicio), hasta };
  }
  const horas = rango === "7d" ? 24 * 7 : 24;
  return { desde: new Date(ahora.getTime() - horas * 3_600_000), hasta };
}

export function getLecturas(galponId: number, desde: Date, hasta: Date): Promise<SerieLecturas[]> {
  return api<SerieLecturas[]>(`/galpones/${galponId}/lecturas`, {
    query: { desde: desde.toISOString(), hasta: hasta.toISOString() },
  });
}

export function marcarDisponible(galponId: number): Promise<void> {
  return api(`/galpones/${galponId}/estado`, { method: "PATCH", body: { estadoOperativo: "disponible" } });
}
