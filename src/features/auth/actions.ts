"use server";

import { redirect } from "next/navigation";
import { api, ApiError } from "@/lib/api-client";
import { loginSchema } from "./schemas";
import { borrarSesion, crearSesion } from "./session";
import type { LoginRespuesta } from "./types";

export interface EstadoLogin {
  error?: string;
  errores?: { email?: string; password?: string };
  email?: string;
}

export async function login(_prev: EstadoLogin, formData: FormData): Promise<EstadoLogin> {
  const datos = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  const email = String(formData.get("email") ?? "");
  if (!datos.success) {
    const e = datos.error.flatten().fieldErrors;
    return { email, errores: { email: e.email?.[0], password: e.password?.[0] } };
  }

  try {
    const { token, usuario } = await api<LoginRespuesta>("/auth/login", {
      method: "POST",
      body: datos.data,
      autenticado: false,
    });
    await crearSesion({ usuario, apiToken: token });
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return { email, error: e.message };
    throw e;
  }
  // Ambos roles arrancan en el dashboard (lo que ve cada uno lo filtra la API),
  // salvo que vengan de una ruta protegida.
  redirect(destinoSeguro(formData.get("desde")));
}

/** Solo rutas internas, para no permitir redirecciones a otros sitios. */
function destinoSeguro(desde: FormDataEntryValue | null): string {
  const ruta = typeof desde === "string" ? desde : "";
  return ruta.startsWith("/") && !ruta.startsWith("//") && ruta !== "/login" ? ruta : "/";
}

export async function logout(): Promise<void> {
  await borrarSesion();
  redirect("/login");
}
