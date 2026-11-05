/**
 * Cliente HTTP de la API (`/api/v1`). Es el ÚNICO punto que sabe si los datos
 * vienen del backend real (`API_URL`) o de los mocks.
 */
import "server-only";
import { redirect } from "next/navigation";
import { obtenerSesion } from "@/features/auth/dal";
import { mockFetch } from "@/mocks/api";
import { apiUrl } from "./env";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface Opciones {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  /** `false` para endpoints públicos (login). Por defecto envía el token de la sesión. */
  autenticado?: boolean;
}

export async function api<T>(ruta: string, opciones: Opciones = {}): Promise<T> {
  const { method = "GET", body, query, autenticado = true } = opciones;

  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined) params.set(k, String(v));
  const rutaCompleta = params.size ? `${ruta}?${params}` : ruta;

  const headers = new Headers({ Accept: "application/json" });
  if (body !== undefined) headers.set("Content-Type", "application/json");
  if (autenticado) {
    const sesion = await obtenerSesion();
    if (!sesion) redirect("/login");
    headers.set("Authorization", `Bearer ${sesion.apiToken}`);
  }

  const init: RequestInit = { method, headers, body: body === undefined ? undefined : JSON.stringify(body) };
  const base = apiUrl();
  const res = base
    ? await fetch(`${base}/api/v1${rutaCompleta}`, { ...init, cache: "no-store" })
    : await mockFetch(rutaCompleta, init);

  if (res.status === 401 && autenticado) redirect("/login");
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new ApiError(res.status, data?.error ?? `Error ${res.status} al llamar a ${ruta}`);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}
