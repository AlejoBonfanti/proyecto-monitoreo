/**
 * Data Access Layer de autenticación: el único lugar donde se lee la sesión.
 * `cache` evita verificar el JWT más de una vez por request.
 */
import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { COOKIE_SESION, verificarSesion } from "./session-token";
import type { Rol, Sesion, Usuario } from "./types";

export const obtenerSesion = cache(async (): Promise<Sesion | null> => {
  const token = (await cookies()).get(COOKIE_SESION)?.value;
  return verificarSesion(token);
});

/** Usuario logueado; si no hay sesión válida redirige al login. */
export async function requerirUsuario(): Promise<Usuario> {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login");
  return sesion.usuario;
}

export async function requerirRol(rol: Rol): Promise<Usuario> {
  const usuario = await requerirUsuario();
  if (usuario.rol !== rol) redirect("/");
  return usuario;
}
