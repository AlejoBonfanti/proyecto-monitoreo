/**
 * Datos semilla de los mocks. Reflejan el mockup MVP (Granja Esperanza,
 * piloto en Galpón 1). Las fechas son relativas al momento en que arranca el
 * servidor para que la demo siempre se vea "en vivo".
 *
 * Las filas siguen el esquema de docs/sql/001_esquema.sql (en camelCase).
 * Simplificación: acá `estado` y `severidad` se guardan; en la base se derivan de las fechas.
 */
import type { Rol } from "@/features/auth/types";
import type { EstadoAlerta, SeveridadAlerta, TipoAlerta } from "@/features/alertas/types";
import type { EstadoOperativo } from "@/features/galpones/types";
import type { EstadoLote } from "@/features/lotes/types";
import type { Metrica } from "@/features/metricas/types";
import { hoyISO, sumarDias } from "@/lib/fechas";

/** `activo`: baja = desactivar, nunca se borra (decisión #35). */
export interface GranjaRow { id: number; nombre: string; ubicacion: string | null; activo: boolean }
export interface GalponRow {
  id: number; granjaId: number; nombre: string; estadoOperativo: EstadoOperativo;
  /** Solo en limpieza (mismo CHECK que la base). */
  fechaInicioLimpieza: string | null; fechaFinLimpiezaEstimada: string | null;
  /** Baja = desactivar (decisión #35). Un galpón inactivo no aparece en `/galpones`. */
  activo: boolean;
}
export interface UsuarioRow {
  id: number; nombre: string; email: string; password: string; rol: Rol; activo: boolean;
  /** E.164; null = no recibe SMS. */
  telefono: string | null;
}
export interface UsuarioGalponRow { usuarioId: number; galponId: number }
export interface LoteRow {
  id: number; galponId: number; numero: string | null; fechaInicio: string; fechaFinEstimada: string;
  fechaFinReal: string | null; estado: EstadoLote; cantidadAvesInicial: number; createdBy: number;
  finalizadoPor: number | null;
}
export interface ReglaAlertaRow {
  id: number; metrica: Metrica; edadDesde: number; edadHasta: number | null; // [desde, hasta); null = sin tope
  minWarning: number | null; maxWarning: number | null; minCritico: number | null; maxCritico: number | null;
  granjaId: number | null; activo: boolean;
}
export interface AlertaRow {
  id: string; tipo: TipoAlerta; galponId: number; nodoId: number | null; loteId: number | null;
  reglaAlertaId: number | null; metrica: Metrica | null;
  severidad: SeveridadAlerta; valorLeido: number | null; estado: EstadoAlerta; fechaDisparo: string;
  fechaReconocimiento: string | null; fechaEscalada: string | null; fechaResolucion: string | null;
  reconocidaPor: number | null; resueltaPor: number | null; resolucionAutomatica: boolean;
}
export interface LecturaRow { galponId: number; metrica: Metrica; valor: number; ts: string }
export interface NodoRow { id: number; galponId: number; identificador: string; ultimaConexion: string | null; activo: boolean }

export interface MockDb {
  granjas: GranjaRow[];
  galpones: GalponRow[];
  usuarios: UsuarioRow[];
  usuarioGalpon: UsuarioGalponRow[];
  lotes: LoteRow[];
  reglas: ReglaAlertaRow[];
  alertas: AlertaRow[];
  lecturasActuales: LecturaRow[];
  nodos: NodoRow[];
  secuencias: { lote: number; usuario: number; granja: number; galpon: number };
}

/** Contraseña de todos los usuarios de demo. Solo existe en los mocks. */
export const PASSWORD_DEMO = "carnave123";

/** UUID fijo y legible para las alertas de demo (en producción los genera el Pi o la nube). */
export function uuidDemo(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

/** Duración estimada de la limpieza (`configuracion_sistema.dias_limpieza_estimados`, provisional). */
export const DIAS_LIMPIEZA_ESTIMADOS = 15;

export function crearDatosSemilla(ahora: Date): MockDb {
  const haceMin = (m: number) => new Date(ahora.getTime() - m * 60_000).toISOString();
  const hoy = hoyISO(ahora);
  const inicioLote = sumarDias(hoy, -18);
  const inicioLimpieza = sumarDias(hoy, -3);
  const sinAtencion = { fechaReconocimiento: null, fechaEscalada: null, fechaResolucion: null, reconocidaPor: null, resueltaPor: null, resolucionAutomatica: false };

  return {
    granjas: [{ id: 1, nombre: "Granja Esperanza", ubicacion: "Esperanza, Santa Fe", activo: true }],
    galpones: [
      { id: 1, granjaId: 1, nombre: "Galpón 1", estadoOperativo: "produccion", fechaInicioLimpieza: null, fechaFinLimpiezaEstimada: null, activo: true },
      { id: 2, granjaId: 1, nombre: "Galpón 2", estadoOperativo: "limpieza", fechaInicioLimpieza: inicioLimpieza, fechaFinLimpiezaEstimada: sumarDias(inicioLimpieza, DIAS_LIMPIEZA_ESTIMADOS), activo: true },
    ],
    usuarios: [
      { id: 1, nombre: "Administrador Carnave", email: "admin@carnave.com", password: PASSWORD_DEMO, rol: "admin", activo: true, telefono: null },
      { id: 2, nombre: "Esteban Martínez", email: "encargado@carnave.com", password: PASSWORD_DEMO, rol: "encargado", activo: true, telefono: "+5493496000000" },
    ],
    usuarioGalpon: [
      { usuarioId: 2, galponId: 1 },
      { usuarioId: 2, galponId: 2 },
    ],
    lotes: [
      { id: 13, galponId: 1, numero: "13", fechaInicio: inicioLote, fechaFinEstimada: sumarDias(inicioLote, 45), fechaFinReal: null, estado: "activo", cantidadAvesInicial: 12400, createdBy: 2, finalizadoPor: null },
      { id: 12, galponId: 1, numero: "12", fechaInicio: "2026-07-05", fechaFinEstimada: "2026-08-19", fechaFinReal: "2026-08-22", estado: "finalizado", cantidadAvesInicial: 12100, createdBy: 2, finalizadoPor: 2 },
      { id: 11, galponId: 1, numero: "11", fechaInicio: "2026-05-15", fechaFinEstimada: "2026-06-29", fechaFinReal: "2026-07-01", estado: "finalizado", cantidadAvesInicial: 12350, createdBy: 2, finalizadoPor: 2 },
    ],
    // Reglas globales (granjaId null) por rango de edad del lote, en días. PROVISIONALES
    // (mismas que docs/sql/002_datos_iniciales.sql). La última de cada métrica no tiene tope.
    reglas: [
      { id: 1, metrica: "temperatura", edadDesde: 0, edadHasta: 8, minWarning: 30, maxWarning: 34, minCritico: 28, maxCritico: 36, granjaId: null, activo: true },
      { id: 2, metrica: "temperatura", edadDesde: 8, edadHasta: 22, minWarning: 24, maxWarning: 28, minCritico: 22, maxCritico: 31, granjaId: null, activo: true },
      { id: 3, metrica: "temperatura", edadDesde: 22, edadHasta: null, minWarning: 18, maxWarning: 25, minCritico: 16, maxCritico: 29, granjaId: null, activo: true },
      { id: 4, metrica: "humedad", edadDesde: 0, edadHasta: null, minWarning: 50, maxWarning: 70, minCritico: 40, maxCritico: 80, granjaId: null, activo: true },
      { id: 5, metrica: "co2", edadDesde: 0, edadHasta: null, minWarning: null, maxWarning: 2500, minCritico: null, maxCritico: 3000, granjaId: null, activo: true },
      { id: 6, metrica: "amoniaco", edadDesde: 0, edadHasta: null, minWarning: null, maxWarning: 10, minCritico: null, maxCritico: 15, granjaId: null, activo: true },
    ],
    alertas: [
      { ...sinAtencion, id: uuidDemo(1), tipo: "ambiental", galponId: 1, nodoId: null, loteId: 13, reglaAlertaId: 6, metrica: "amoniaco", severidad: "critica", valorLeido: 18, estado: "escalada", fechaDisparo: haceMin(41), fechaEscalada: haceMin(11) },
      { ...sinAtencion, id: uuidDemo(2), tipo: "ambiental", galponId: 1, nodoId: null, loteId: 13, reglaAlertaId: 5, metrica: "co2", severidad: "warning", valorLeido: 2850, estado: "activa", fechaDisparo: haceMin(6) },
      { ...sinAtencion, id: uuidDemo(3), tipo: "ambiental", galponId: 1, nodoId: null, loteId: 13, reglaAlertaId: 2, metrica: "temperatura", severidad: "warning", valorLeido: 28.3, estado: "reconocida", fechaDisparo: haceMin(35), fechaReconocimiento: haceMin(12), reconocidaPor: 2 },
      { ...sinAtencion, id: uuidDemo(4), tipo: "ambiental", galponId: 1, nodoId: null, loteId: 13, reglaAlertaId: 4, metrica: "humedad", severidad: "warning", valorLeido: 72, estado: "resuelta", fechaDisparo: haceMin(60 * 50), fechaResolucion: haceMin(60 * 48), resolucionAutomatica: true },
      // Salud del nodo: se evalúa aunque el galpón esté en limpieza. Nace crítica.
      { ...sinAtencion, id: uuidDemo(5), tipo: "nodo_caido", galponId: 2, nodoId: 2, loteId: null, reglaAlertaId: null, metrica: null, severidad: "critica", valorLeido: null, estado: "resuelta", fechaDisparo: haceMin(60 * 26), fechaResolucion: haceMin(60 * 25), resolucionAutomatica: true },
    ],
    lecturasActuales: [
      { galponId: 1, metrica: "temperatura", valor: 27.4, ts: haceMin(1) },
      { galponId: 1, metrica: "humedad", valor: 61, ts: haceMin(1) },
      { galponId: 1, metrica: "co2", valor: 2850, ts: haceMin(1) },
      { galponId: 1, metrica: "amoniaco", valor: 9, ts: haceMin(1) },
      { galponId: 2, metrica: "temperatura", valor: 21.2, ts: haceMin(4) },
      { galponId: 2, metrica: "humedad", valor: 55, ts: haceMin(4) },
      { galponId: 2, metrica: "co2", valor: 640, ts: haceMin(4) },
      { galponId: 2, metrica: "amoniaco", valor: 4, ts: haceMin(4) },
    ],
    nodos: [
      { id: 1, galponId: 1, identificador: "AA:BB:CC:00:00:01", ultimaConexion: haceMin(1), activo: true },
      { id: 2, galponId: 2, identificador: "AA:BB:CC:00:00:02", ultimaConexion: haceMin(4), activo: true },
    ],
    secuencias: { lote: 14, usuario: 3, granja: 2, galpon: 3 },
  };
}
