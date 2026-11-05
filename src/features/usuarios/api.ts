import "server-only";
import { getGalpones } from "@/features/galpones/api";
import { api, ApiError } from "@/lib/api-client";
import type { CambiosUsuario, NuevoUsuario, UsuarioAdmin } from "./types";

export function getUsuarios(): Promise<UsuarioAdmin[]> {
  return api<UsuarioAdmin[]>("/usuarios");
}

/** `null` si no existe. */
export async function getUsuario(id: number): Promise<UsuarioAdmin | null> {
  try {
    return await api<UsuarioAdmin>(`/usuarios/${id}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export function crear(usuario: NuevoUsuario): Promise<UsuarioAdmin> {
  return api<UsuarioAdmin>("/usuarios", { method: "POST", body: usuario });
}

export function actualizar(id: number, cambios: CambiosUsuario): Promise<UsuarioAdmin> {
  return api<UsuarioAdmin>(`/usuarios/${id}`, { method: "PATCH", body: cambios });
}

/** Todos los galpones (el admin los ve todos), para asignarle a un encargado. */
export async function getOpcionesGalpones(): Promise<{ id: number; nombre: string; granja: string }[]> {
  const galpones = await getGalpones();
  return galpones.map((g) => ({ id: g.id, nombre: g.nombre, granja: g.granja.nombre }));
}
