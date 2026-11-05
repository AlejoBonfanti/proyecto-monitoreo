import "server-only";
import { cookies } from "next/headers";
import { COOKIE_SESION, DURACION_SESION_SEG, firmarSesion } from "./session-token";
import type { Sesion } from "./types";

export async function crearSesion(sesion: Sesion): Promise<void> {
  const token = await firmarSesion(sesion);
  (await cookies()).set(COOKIE_SESION, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DURACION_SESION_SEG,
  });
}

export async function borrarSesion(): Promise<void> {
  (await cookies()).delete(COOKIE_SESION);
}
