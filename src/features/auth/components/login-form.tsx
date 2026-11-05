"use client";

import { useActionState } from "react";
import { Field } from "@/components/ui/field";
import { MensajeError } from "@/components/ui/mensaje-error";
import { SubmitButton } from "@/components/ui/submit-button";
import { login, type EstadoLogin } from "../actions";

export function LoginForm({ desde }: { desde?: string }) {
  const [estado, accion] = useActionState<EstadoLogin, FormData>(login, {});

  return (
    <form action={accion} noValidate className="grid gap-4">
      {desde && <input type="hidden" name="desde" value={desde} />}
      <Field
        label="Usuario"
        name="email"
        type="email"
        autoComplete="username"
        placeholder="nombre@carnave.com"
        defaultValue={estado.email}
        error={estado.errores?.email}
        required
      />
      <Field
        label="Contraseña"
        name="password"
        type="password"
        autoComplete="current-password"
        placeholder="••••••••"
        error={estado.errores?.password}
        required
      />
      <MensajeError>{estado.error}</MensajeError>
      <SubmitButton pendiente="Ingresando…" className="w-full">
        Ingresar
      </SubmitButton>
    </form>
  );
}
