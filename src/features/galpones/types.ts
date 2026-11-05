import type { Metrica, Severidad, Umbrales } from "@/features/metricas/types";

export type EstadoOperativo = "produccion" | "limpieza" | "disponible";

/** Salud del nodo ESP32 según su última conexión (lo decide el backend). */
export type EstadoNodo = "online" | "retrasado" | "caido";

export interface LecturaActual {
  metrica: Metrica;
  valor: number;
  ts: string;
  /** `null` cuando el galpón no está en producción: el motor no evalúa. */
  severidad: Severidad | null;
}

export interface LoteActivoResumen {
  id: number;
  numero: string | null;
  fechaInicio: string;
  fechaFinEstimada: string;
  cantidadAvesInicial: number;
  /** Calculada por el backend (`edad_dias`). */
  edadDias: number;
}

/** `GET /api/v1/galpones` y `GET /api/v1/galpones/:id`. */
export interface Galpon {
  id: number;
  nombre: string;
  granja: { id: number; nombre: string };
  estadoOperativo: EstadoOperativo;
  nodo: { ultimaConexion: string | null; estado: EstadoNodo };
  loteActivo: LoteActivoResumen | null;
  /** Solo con el galpón en limpieza: desde cuándo y fin estimado (fin real del lote + días de limpieza configurados). */
  limpieza: { fechaInicio: string; fechaFinEstimada: string } | null;
  lecturas: LecturaActual[];
  /** Alertas activas o escaladas (sin reconocer), de cualquier tipo. */
  alertasSinAtender: number;
  /** Umbrales de la regla vigente para la edad del lote. Vacío fuera de producción. */
  umbrales: Partial<Record<Metrica, Umbrales>>;
}

export interface PuntoLectura {
  ts: string;
  valor: number;
}

/** `GET /api/v1/galpones/:id/lecturas?desde=&hasta=` */
export interface SerieLecturas {
  metrica: Metrica;
  puntos: PuntoLectura[];
}

export type RangoLecturas = "24h" | "7d" | "lote";
