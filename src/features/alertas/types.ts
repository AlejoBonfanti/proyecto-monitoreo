import type { Metrica } from "@/features/metricas/types";

export type EstadoAlerta = "activa" | "reconocida" | "escalada" | "resuelta";
export type SeveridadAlerta = "warning" | "critica";

/**
 * - `ambiental`: una métrica fuera de umbral (solo con el galpón en producción).
 * - `nodo_caido`: el ESP32 dejó de reportar (se evalúa en cualquier estado operativo).
 * - `dato_retrasado`: el nodo reporta pero una métrica no llega (sensor o bus Modbus).
 */
export type TipoAlerta = "ambiental" | "nodo_caido" | "dato_retrasado";

interface Referencia {
  id: number;
  nombre: string;
}

/** `GET /api/v1/alertas` */
export interface Alerta {
  /** UUID: lo genera quien crea la alerta (el Pi o la nube). */
  id: string;
  tipo: TipoAlerta;
  galpon: Referencia;
  /** `null` en `nodo_caido`. */
  metrica: Metrica | null;
  severidad: SeveridadAlerta;
  /** Solo en `ambiental`: el valor que la disparó (o que la subió a crítica). */
  valorLeido: number | null;
  estado: EstadoAlerta;
  fechaDisparo: string;
  fechaReconocimiento: string | null;
  fechaEscalada: string | null;
  fechaResolucion: string | null;
  reconocidaPor: Referencia | null;
  resueltaPor: Referencia | null;
  resolucionAutomatica: boolean;
}
