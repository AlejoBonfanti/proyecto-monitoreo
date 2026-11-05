"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requerirRol } from "@/features/auth/dal";
import { ApiError } from "@/lib/api-client";
import { actualizar, actualizarGalpon, crear, crearGalpon } from "./api";
import { datosDelFormulario, galponSchema, granjaSchema } from "./schemas";

type Campo = "nombre" | "ubicacion";

export interface EstadoGranjaForm {
  error?: string;
  errores?: Partial<Record<Campo, string>>;
  /** Lo que se había escrito, para no perderlo si hay un error. */
  valores?: { nombre: string; ubicacion: string };
}

function valoresDe(formData: FormData): EstadoGranjaForm["valores"] {
  return { nombre: String(formData.get("nombre") ?? ""), ubicacion: String(formData.get("ubicacion") ?? "") };
}

function erroresDeCampo(e: { flatten(): { fieldErrors: Partial<Record<string, string[]>> } }): EstadoGranjaForm {
  const f = e.flatten().fieldErrors;
  return { errores: { nombre: f.nombre?.[0], ubicacion: f.ubicacion?.[0] } };
}

/** Errores de negocio de la API (nombre repetido, granja con galpones activos…) se muestran en el formulario. */
function errorDeApi(e: unknown): EstadoGranjaForm {
  if (e instanceof ApiError && (e.status === 400 || e.status === 409)) return { error: e.message };
  throw e;
}

/** El nombre de la granja aparece en el dashboard y en el detalle de cada galpón. */
function revalidar() {
  revalidatePath("/", "layout");
}

export async function crearGranja(_prev: EstadoGranjaForm, formData: FormData): Promise<EstadoGranjaForm> {
  await requerirRol("admin");
  const datos = granjaSchema.safeParse(datosDelFormulario(formData));
  if (!datos.success) return { ...erroresDeCampo(datos.error), valores: valoresDe(formData) };
  let id: number;
  try {
    id = (await crear(datos.data)).id;
  } catch (e) {
    return { ...errorDeApi(e), valores: valoresDe(formData) };
  }
  revalidar();
  // A la ficha de la granja, para cargarle los galpones.
  redirect(`/granjas/${id}`);
}

export async function editarGranja(id: number, _prev: EstadoGranjaForm, formData: FormData): Promise<EstadoGranjaForm> {
  await requerirRol("admin");
  const datos = granjaSchema.safeParse(datosDelFormulario(formData));
  if (!datos.success) return { ...erroresDeCampo(datos.error), valores: valoresDe(formData) };
  try {
    await actualizar(id, datos.data);
  } catch (e) {
    return { ...errorDeApi(e), valores: valoresDe(formData) };
  }
  revalidar();
  redirect("/granjas");
}

/** Baja (desactivar) o reactivación. Nunca se borra: lotes, lecturas y alertas guardan la historia. */
export async function cambiarActivoGranja(id: number, activo: boolean): Promise<EstadoGranjaForm> {
  await requerirRol("admin");
  try {
    await actualizar(id, { activo });
  } catch (e) {
    return errorDeApi(e);
  }
  revalidar();
  return {};
}

// ---------- Galpones de la granja ----------

export interface EstadoGalponForm {
  error?: string;
  /** Cambia en cada guardado exitoso: el formulario lo usa para limpiarse o cerrarse. */
  ok?: number;
  /** Lo que se había escrito, para no perderlo si hay un error. */
  valor?: string;
}

function errorGalpon(e: unknown): EstadoGalponForm {
  if (e instanceof ApiError && (e.status === 400 || e.status === 409)) return { error: e.message };
  throw e;
}

/** Alta de galpón: nace `disponible`, sin nodo. */
export async function agregarGalpon(granjaId: number, _prev: EstadoGalponForm, formData: FormData): Promise<EstadoGalponForm> {
  await requerirRol("admin");
  const valor = String(formData.get("nombre") ?? "");
  const datos = galponSchema.safeParse({ nombre: valor });
  if (!datos.success) return { error: datos.error.issues[0].message, valor };
  try {
    await crearGalpon(granjaId, datos.data);
  } catch (e) {
    return { ...errorGalpon(e), valor };
  }
  revalidar();
  return { ok: Date.now() };
}

export async function renombrarGalpon(id: number, _prev: EstadoGalponForm, formData: FormData): Promise<EstadoGalponForm> {
  await requerirRol("admin");
  const valor = String(formData.get("nombre") ?? "");
  const datos = galponSchema.safeParse({ nombre: valor });
  if (!datos.success) return { error: datos.error.issues[0].message, valor };
  try {
    await actualizarGalpon(id, datos.data);
  } catch (e) {
    return { ...errorGalpon(e), valor };
  }
  revalidar();
  return { ok: Date.now() };
}

/** Baja (desactivar) o reactivación. En producción no se puede dar de baja: primero se finaliza el lote. */
export async function cambiarActivoGalpon(id: number, activo: boolean): Promise<EstadoGalponForm> {
  await requerirRol("admin");
  try {
    await actualizarGalpon(id, { activo });
  } catch (e) {
    return errorGalpon(e);
  }
  revalidar();
  return { ok: Date.now() };
}
