"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requerirRol } from "@/features/auth/dal";
import { ApiError } from "@/lib/api-client";
import { actualizar, crear } from "./api";
import { datosDelFormulario, editarUsuarioSchema, nuevoUsuarioSchema } from "./schemas";

type Campo = "nombre" | "email" | "rol" | "password" | "telefono" | "galponIds";

export interface EstadoUsuarioForm {
  error?: string;
  errores?: Partial<Record<Campo, string>>;
  /** Lo que se había escrito (sin la contraseña), para no perderlo si hay un error. */
  valores?: { nombre: string; email: string; rol: string; telefono: string; galponIds: number[] };
}

function valoresDe(formData: FormData): EstadoUsuarioForm["valores"] {
  return {
    nombre: String(formData.get("nombre") ?? ""),
    email: String(formData.get("email") ?? ""),
    rol: String(formData.get("rol") ?? ""),
    telefono: String(formData.get("telefono") ?? ""),
    galponIds: formData.getAll("galponIds").map(Number),
  };
}

function erroresDeCampo(e: { flatten(): { fieldErrors: Partial<Record<string, string[]>> } }): EstadoUsuarioForm {
  const f = e.flatten().fieldErrors;
  const errores: EstadoUsuarioForm["errores"] = {};
  for (const campo of ["nombre", "email", "rol", "password", "telefono", "galponIds"] as const) errores[campo] = f[campo]?.[0];
  return { errores };
}

/** Errores de negocio de la API (email repetido, último admin…) se muestran en el formulario. */
function errorDeApi(e: unknown): EstadoUsuarioForm {
  if (e instanceof ApiError && (e.status === 400 || e.status === 409)) return { error: e.message };
  throw e;
}

export async function crearUsuario(_prev: EstadoUsuarioForm, formData: FormData): Promise<EstadoUsuarioForm> {
  await requerirRol("admin");
  const datos = nuevoUsuarioSchema.safeParse(datosDelFormulario(formData));
  if (!datos.success) return { ...erroresDeCampo(datos.error), valores: valoresDe(formData) };
  try {
    await crear(datos.data);
  } catch (e) {
    return { ...errorDeApi(e), valores: valoresDe(formData) };
  }
  revalidatePath("/usuarios");
  redirect("/usuarios");
}

export async function editarUsuario(id: number, _prev: EstadoUsuarioForm, formData: FormData): Promise<EstadoUsuarioForm> {
  await requerirRol("admin");
  const datos = editarUsuarioSchema.safeParse(datosDelFormulario(formData));
  if (!datos.success) return { ...erroresDeCampo(datos.error), valores: valoresDe(formData) };
  const { password, ...resto } = datos.data;
  try {
    await actualizar(id, password ? { ...resto, password } : resto);
  } catch (e) {
    return { ...errorDeApi(e), valores: valoresDe(formData) };
  }
  revalidatePath("/usuarios");
  redirect("/usuarios");
}

/** Baja (desactivar) o reactivación. Nunca se borra: los lotes y alertas guardan quién hizo qué. */
export async function cambiarActivo(id: number, activo: boolean): Promise<EstadoUsuarioForm> {
  await requerirRol("admin");
  try {
    await actualizar(id, { activo });
  } catch (e) {
    return errorDeApi(e);
  }
  revalidatePath("/usuarios");
  revalidatePath(`/usuarios/${id}`);
  return {};
}
