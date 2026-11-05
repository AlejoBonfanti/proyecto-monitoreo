/**
 * Firma y verificación del JWT de sesión. Sin `server-only` ni `next/headers`
 * porque también lo usa `proxy.ts`.
 */
import { SignJWT, jwtVerify } from "jose";
import { sessionSecret } from "@/lib/env";
import type { Sesion } from "./types";

export const COOKIE_SESION = "carnave_sesion";
export const DURACION_SESION_SEG = 60 * 60 * 12; // 12 h: un turno de trabajo

export async function firmarSesion(sesion: Sesion): Promise<string> {
  return new SignJWT({ usuario: sesion.usuario, apiToken: sesion.apiToken })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(sesion.usuario.id))
    .setIssuedAt()
    .setExpirationTime(`${DURACION_SESION_SEG}s`)
    .sign(sessionSecret());
}

/** Devuelve la sesión si el token es válido y no venció; si no, `null`. */
export async function verificarSesion(token: string | undefined): Promise<Sesion | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionSecret(), { algorithms: ["HS256"] });
    const { usuario, apiToken } = payload as unknown as Partial<Sesion>;
    if (!usuario || typeof apiToken !== "string") return null;
    return { usuario, apiToken };
  } catch {
    return null;
  }
}
