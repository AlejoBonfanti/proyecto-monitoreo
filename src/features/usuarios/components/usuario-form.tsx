"use client";

import { useActionState, useState } from "react";
import { Field } from "@/components/ui/field";
import { MensajeError } from "@/components/ui/mensaje-error";
import { SubmitButton } from "@/components/ui/submit-button";
import type { Rol } from "@/features/auth/types";
import type { EstadoUsuarioForm } from "../actions";
import type { UsuarioAdmin } from "../types";

interface Props {
  accion: (prev: EstadoUsuarioForm, formData: FormData) => Promise<EstadoUsuarioForm>;
  /** Todos los galpones, para asignar a un encargado. */
  galpones: { id: number; nombre: string; granja: string }[];
  /** Si viene, es edición. */
  usuario?: UsuarioAdmin;
}

export function UsuarioForm({ accion, galpones, usuario }: Props) {
  const [estado, enviar] = useActionState(accion, {});
  const [rol, setRol] = useState<Rol>(usuario?.rol ?? "encargado");
  const e = estado.errores ?? {};
  // Si hubo un error, se muestra lo que se había escrito; si no, los datos guardados.
  const v = estado.valores;
  const asignados = new Set(v ? v.galponIds : usuario?.galpones.map((g) => g.id));
  const variasGranjas = new Set(galpones.map((g) => g.granja)).size > 1;

  return (
    <form action={enviar} noValidate className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre y apellido" name="nombre" defaultValue={v?.nombre ?? usuario?.nombre} required maxLength={100} error={e.nombre} />
        <Field label="Email (usuario para entrar)" name="email" type="email" defaultValue={v?.email ?? usuario?.email} required error={e.email} />

        <div>
          <label htmlFor="rol" className="mb-[5px] block text-[12.5px] text-ink-muted">
            Rol
          </label>
          <select
            id="rol"
            name="rol"
            value={rol}
            onChange={(ev) => setRol(ev.target.value as Rol)}
            className="w-full rounded-[5px] border border-line bg-surface px-[11px] py-[9px] text-[13.5px] text-ink focus:border-accent focus:outline-none"
          >
            <option value="encargado">Encargado — opera los galpones asignados</option>
            <option value="admin">Admin — todo, más reglas, configuración y usuarios</option>
          </select>
          {e.rol && <p className="mt-1 text-xs text-danger">{e.rol}</p>}
        </div>

        <Field
          label={usuario ? "Nueva contraseña (opcional)" : "Contraseña inicial"}
          name="password"
          type="password"
          autoComplete="new-password"
          required={!usuario}
          ayuda={usuario ? "Dejala vacía para no cambiarla." : "Mínimo 8 caracteres."}
          error={e.password}
        />

        <Field
          label="Teléfono para SMS (opcional)"
          name="telefono"
          type="tel"
          inputMode="tel"
          placeholder="+5493496123456"
          defaultValue={v?.telefono ?? usuario?.telefono ?? ""}
          ayuda="Recibe un SMS cuando una alerta de sus galpones pasa a crítica. Vacío = sin SMS."
          error={e.telefono}
        />
      </div>

      {rol === "encargado" ? (
        <fieldset>
          <legend className="mb-2 text-[12.5px] text-ink-muted">Galpones asignados</legend>
          {galpones.length === 0 ? (
            <p className="text-[13px] text-ink-muted">No hay galpones cargados.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-3">
              {galpones.map((g) => (
                <label key={g.id} className="flex items-center gap-2 rounded-[5px] border border-line px-3 py-2 text-[13px]">
                  <input type="checkbox" name="galponIds" value={g.id} defaultChecked={asignados.has(g.id)} className="accent-[var(--color-accent)]" />
                  {g.nombre}
                  {variasGranjas && <span className="text-xs text-ink-muted">· {g.granja}</span>}
                </label>
              ))}
            </div>
          )}
          {e.galponIds && <p className="mt-1 text-xs text-danger">{e.galponIds}</p>}
        </fieldset>
      ) : (
        <p className="rounded-md bg-surface-muted px-3.5 py-3 text-[12.5px] text-ink-muted">
          El admin ve todos los galpones de todas las granjas; no hace falta asignarle ninguno.
        </p>
      )}

      <MensajeError>{estado.error}</MensajeError>
      <div>
        <SubmitButton pendiente="Guardando…">{usuario ? "Guardar cambios" : "Crear usuario"}</SubmitButton>
      </div>
    </form>
  );
}
