"use client";

import { useFormStatus } from "react-dom";
import { Button, type VarianteBoton } from "./button";

/** Botón de envío que se deshabilita mientras la Server Action está en curso. */
export function SubmitButton({
  children,
  pendiente,
  variante = "primario",
  tamano,
  className,
}: {
  children: React.ReactNode;
  /** Texto mientras envía. */
  pendiente?: string;
  variante?: VarianteBoton;
  tamano?: "md" | "sm";
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variante={variante} tamano={tamano} disabled={pending} aria-busy={pending} className={className}>
      {pending && pendiente ? pendiente : children}
    </Button>
  );
}
