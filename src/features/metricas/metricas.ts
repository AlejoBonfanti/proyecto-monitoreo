import type { Metrica } from "./types";

interface MetaMetrica {
  nombre: string;
  /** Etiqueta corta para tarjetas. */
  corto: string;
  unidad: string;
  decimales: number;
}

export const META_METRICA: Record<Metrica, MetaMetrica> = {
  temperatura: { nombre: "Temperatura", corto: "Temp", unidad: "°C", decimales: 1 },
  humedad: { nombre: "Humedad", corto: "Hum", unidad: "%", decimales: 0 },
  co2: { nombre: "CO2", corto: "CO2", unidad: "ppm", decimales: 0 },
  amoniaco: { nombre: "Amoníaco", corto: "NH3", unidad: "ppm", decimales: 0 },
};

/** Orden de las métricas en la tarjeta del dashboard. */
export const ORDEN_TARJETA: Metrica[] = ["temperatura", "humedad", "co2", "amoniaco"];

/** Orden de la grilla de gráficos en la vista de galpón (como el mockup). */
export const ORDEN_GRAFICOS: Metrica[] = ["temperatura", "co2", "humedad", "amoniaco"];
