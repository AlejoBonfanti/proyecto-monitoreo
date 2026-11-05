export type Rol = "admin" | "encargado";

export interface Usuario {
  id: number;
  nombre: string;
  email: string;
  rol: Rol;
}

/** Respuesta de `POST /api/v1/auth/login`. */
export interface LoginRespuesta {
  token: string;
  usuario: Usuario;
}

/** Contenido de la cookie de sesión (JWT firmado por el frontend). */
export interface Sesion {
  usuario: Usuario;
  /** Token emitido por la API; se reenvía como `Authorization: Bearer`. */
  apiToken: string;
}
