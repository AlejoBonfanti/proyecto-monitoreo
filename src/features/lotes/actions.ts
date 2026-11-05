"use server";

import { revalidatePath } from "next/cache";
import { requerirUsuario } from "@/features/auth/dal";
import { ApiError } from "@/lib/api-client";
import { crear, finalizar } from "./api";
import { nuevoLoteSchema } from "./schemas";

export interface EstadoNuevoLote {
  ok?: boolean;
  error?: string;
  errores?: Partial<Record<"numero" | "fechaInicio" | "fechaFinEstimada" | "cantidadAvesInicial", string>>;
}

export async function crearLote(
  galponId: number,
  _prev: EstadoNuevoLote,
  formData: FormData,
): Promise<EstadoNuevoLote> {
  await requerirUsuario();
  const datos = nuevoLoteSchema.safeParse(Object.fromEntries(formData));
  if (!datos.success) {
    const e = datos.error.flatten().fieldErrors;
    return {
      errores: {
        numero: e.numero?.[0],
        fechaInicio: e.fechaInicio?.[0],
        fechaFinEstimada: e.fechaFinEstimada?.[0],
        cantidadAvesInicial: e.cantidadAvesInicial?.[0],
      },
    };
  }
  try {
    await crear(galponId, datos.data);
  } catch (e) {
    if (e instanceof ApiError && (e.status === 400 || e.status === 409)) return { error: e.message };
    throw e;
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function finalizarLote(loteId: number): Promise<void> {
  await requerirUsuario();
  await finalizar(loteId);
  revalidatePath("/", "layout");
}
