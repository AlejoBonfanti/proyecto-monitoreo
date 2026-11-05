import { z } from "zod";

/** Formulario de granja. Ubicación vacía = `null`. */
export const granjaSchema = z.object({
  nombre: z.string().trim().min(1, "Ingresá el nombre.").max(100, "Máximo 100 caracteres."),
  ubicacion: z
    .string()
    .trim()
    .max(200, "Máximo 200 caracteres.")
    .transform((v) => v || null),
});

/** Formulario de galpón: solo el nombre (el estado lo manejan los lotes). */
export const galponSchema = z.object({
  nombre: z.string().trim().min(1, "Ingresá el nombre.").max(100, "Máximo 100 caracteres."),
});

/** Convierte el FormData en un objeto para el schema. */
export function datosDelFormulario(formData: FormData) {
  return {
    nombre: formData.get("nombre") ?? "",
    ubicacion: formData.get("ubicacion") ?? "",
  };
}
