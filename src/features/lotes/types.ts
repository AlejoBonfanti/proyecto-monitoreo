/** Un lote nace activo (el galpón pasa a producción) y termina finalizado (pasa a limpieza). */
export type EstadoLote = "activo" | "finalizado";

/** `GET /api/v1/galpones/:id/lotes` */
export interface Lote {
  id: number;
  galponId: number;
  /** Número de lote cargado por el usuario (opcional). */
  numero: string | null;
  fechaInicio: string;
  fechaFinEstimada: string;
  fechaFinReal: string | null;
  estado: EstadoLote;
  cantidadAvesInicial: number;
}

/** Body de `POST /api/v1/galpones/:id/lotes`. `fechaInicio` no puede ser futura. */
export interface NuevoLote {
  numero: string | null;
  fechaInicio: string;
  fechaFinEstimada: string;
  cantidadAvesInicial: number;
}
