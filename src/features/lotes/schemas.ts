import { z } from "zod";
import { hoyISO } from "@/lib/fechas";

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida.");

export const nuevoLoteSchema = z
  .object({
    numero: z
      .string()
      .trim()
      .max(20, "Máximo 20 caracteres.")
      .transform((v) => v || null),
    fechaInicio: fecha,
    fechaFinEstimada: fecha,
    cantidadAvesInicial: z.coerce
      .number({ error: "Ingresá un número." })
      .int("Tiene que ser un número entero.")
      .positive("Tiene que ser mayor a 0."),
  })
  // Mismo criterio que la base: un lote no puede empezar en el futuro (hoy = hoy en Argentina).
  .refine((d) => d.fechaInicio <= hoyISO(), {
    path: ["fechaInicio"],
    message: "No puede ser una fecha futura.",
  })
  .refine((d) => d.fechaFinEstimada > d.fechaInicio, {
    path: ["fechaFinEstimada"],
    message: "Tiene que ser posterior a la fecha de inicio.",
  });

export type NuevoLoteInput = z.input<typeof nuevoLoteSchema>;
