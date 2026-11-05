import { z } from "zod";

/** Teléfono para SMS en formato E.164 (mismo CHECK que la base). Vacío = sin SMS. */
const telefono = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ""))
  .refine((v) => v === "" || /^\+[1-9]\d{7,14}$/.test(v), "Formato internacional, ej: +5493496123456.")
  .transform((v) => v || null);

const base = {
  nombre: z.string().trim().min(1, "Ingresá el nombre.").max(100, "Máximo 100 caracteres."),
  email: z.string().trim().toLowerCase().pipe(z.email("Email inválido.")),
  rol: z.enum(["admin", "encargado"], { error: "Elegí un rol." }),
  telefono,
  galponIds: z.array(z.coerce.number().int().positive()).default([]),
};

const password = z.string().min(8, "Mínimo 8 caracteres.").max(128, "Máximo 128 caracteres.");

/** El admin ve todos los galpones: no lleva asignaciones. */
function sinGalponesSiEsAdmin<T extends { rol: string; galponIds: number[] }>(d: T): T {
  return d.rol === "admin" ? { ...d, galponIds: [] } : d;
}

export const nuevoUsuarioSchema = z.object({ ...base, password }).transform(sinGalponesSiEsAdmin);

/** En la edición la contraseña es opcional: vacía = no se cambia. */
export const editarUsuarioSchema = z
  .object({ ...base, password: z.union([z.literal("").transform(() => undefined), password]) })
  .transform(sinGalponesSiEsAdmin);

/** Convierte el FormData (galpones como checkboxes repetidos) en un objeto para los schemas. */
export function datosDelFormulario(formData: FormData) {
  return {
    nombre: formData.get("nombre") ?? "",
    email: formData.get("email") ?? "",
    rol: formData.get("rol") ?? "",
    password: formData.get("password") ?? "",
    telefono: formData.get("telefono") ?? "",
    galponIds: formData.getAll("galponIds"),
  };
}
