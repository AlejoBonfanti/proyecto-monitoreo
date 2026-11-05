import type { EstadoOperativo } from "@/features/galpones/types";

/** Galpón dentro de `GranjaAdmin` (solo admin). El estado lo manejan los lotes: acá no se edita. */
export interface GalponAdmin {
  id: number;
  nombre: string;
  estadoOperativo: EstadoOperativo;
  /** Baja = desactivar (decisión #35): nunca se borra, lotes y alertas guardan la historia. */
  activo: boolean;
}

/** `GET /api/v1/granjas` y `GET /api/v1/granjas/:id` (solo admin). */
export interface GranjaAdmin {
  id: number;
  nombre: string;
  ubicacion: string | null;
  activo: boolean;
  galpones: GalponAdmin[];
}

/** Body de `POST /api/v1/granjas`. */
export interface NuevaGranja {
  nombre: string;
  ubicacion: string | null;
}

/** Body de `PATCH /api/v1/granjas/:id`: solo los campos que cambian. */
export type CambiosGranja = Partial<NuevaGranja> & { activo?: boolean };

/** Body de `POST /api/v1/granjas/:id/galpones`. Nace `disponible`. */
export interface NuevoGalpon {
  nombre: string;
}

/** Body de `PATCH /api/v1/galpones/:id`: solo nombre y baja/reactivación. */
export type CambiosGalpon = Partial<NuevoGalpon> & { activo?: boolean };
