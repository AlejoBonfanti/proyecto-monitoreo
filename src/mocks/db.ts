import { ahora } from "@/lib/fechas";
import { crearDatosSemilla, type MockDb } from "./datos";

/**
 * Base en memoria. Se guarda en `globalThis` para sobrevivir al hot reload
 * de `next dev`; se reinicia al reiniciar el servidor.
 */
const g = globalThis as unknown as { __carnaveMockDb?: MockDb };

export function db(): MockDb {
  g.__carnaveMockDb ??= crearDatosSemilla(ahora());
  return g.__carnaveMockDb;
}

/** Para tests: reinicia la base con una fecha fija. */
export function reiniciarDb(fecha: Date = ahora()): MockDb {
  g.__carnaveMockDb = crearDatosSemilla(fecha);
  return g.__carnaveMockDb;
}
