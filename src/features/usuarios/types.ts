import type { Rol } from "@/features/auth/types";

/** `GET /api/v1/usuarios` (solo admin). */
export interface UsuarioAdmin {
  id: number;
  nombre: string;
  email: string;
  rol: Rol;
  /** E.164 (+549…). `null` = no recibe SMS. */
  telefono: string | null;
  /** Un usuario desactivado no puede entrar. La baja nunca borra (auditoría). */
  activo: boolean;
  /** Galpones asignados. Vacío para el admin: ve todos sin asignación. */
  galpones: { id: number; nombre: string }[];
}

/** Body de `POST /api/v1/usuarios`. */
export interface NuevoUsuario {
  nombre: string;
  email: string;
  rol: Rol;
  password: string;
  telefono: string | null;
  galponIds: number[];
}

/** Body de `PATCH /api/v1/usuarios/:id`: solo los campos que cambian. */
export type CambiosUsuario = Partial<Omit<NuevoUsuario, "password">> & { password?: string; activo?: boolean };
