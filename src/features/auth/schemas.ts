import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().min(1, "Ingresá tu usuario.").email("Ingresá un email válido."),
  password: z.string().min(1, "Ingresá tu contraseña."),
});
