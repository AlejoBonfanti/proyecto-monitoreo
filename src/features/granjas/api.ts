import "server-only";
import { api, ApiError } from "@/lib/api-client";
import type { CambiosGalpon, CambiosGranja, GalponAdmin, GranjaAdmin, NuevaGranja, NuevoGalpon } from "./types";

export function getGranjas(): Promise<GranjaAdmin[]> {
  return api<GranjaAdmin[]>("/granjas");
}

/** `null` si no existe. */
export async function getGranja(id: number): Promise<GranjaAdmin | null> {
  try {
    return await api<GranjaAdmin>(`/granjas/${id}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export function crear(granja: NuevaGranja): Promise<GranjaAdmin> {
  return api<GranjaAdmin>("/granjas", { method: "POST", body: granja });
}

export function actualizar(id: number, cambios: CambiosGranja): Promise<GranjaAdmin> {
  return api<GranjaAdmin>(`/granjas/${id}`, { method: "PATCH", body: cambios });
}

export function crearGalpon(granjaId: number, galpon: NuevoGalpon): Promise<GalponAdmin> {
  return api<GalponAdmin>(`/granjas/${granjaId}/galpones`, { method: "POST", body: galpon });
}

export function actualizarGalpon(id: number, cambios: CambiosGalpon): Promise<GalponAdmin> {
  return api<GalponAdmin>(`/galpones/${id}`, { method: "PATCH", body: cambios });
}
