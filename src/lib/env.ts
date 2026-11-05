/**
 * Configuración por variables de entorno (ver `.env.example`).
 * Sin `API_URL` la app usa los mocks de `src/mocks`, que simulan la API.
 */
export function apiUrl(): string | null {
  const url = process.env.API_URL?.trim();
  return url ? url.replace(/\/+$/, "") : null;
}

export function usarMocks(): boolean {
  return apiUrl() === null;
}

const SECRETO_DESARROLLO = "carnave-dev-secret-no-usar-en-produccion";

export function sessionSecret(): Uint8Array {
  const secreto = process.env.SESSION_SECRET;
  if (!secreto) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Falta la variable de entorno SESSION_SECRET.");
    }
    return new TextEncoder().encode(SECRETO_DESARROLLO);
  }
  return new TextEncoder().encode(secreto);
}
