import type { ButtonHTMLAttributes } from "react";

export type VarianteBoton = "primario" | "secundario" | "peligro" | "peligro-borde";

const VARIANTES: Record<VarianteBoton, string> = {
  primario: "border-accent bg-accent font-semibold text-white hover:bg-accent-hover",
  secundario: "border-line bg-surface text-ink hover:bg-surface-muted",
  peligro: "border-danger bg-danger text-white hover:opacity-90",
  "peligro-borde": "border-danger bg-transparent text-danger hover:bg-danger-bg",
};

const TAMANOS = {
  md: "px-3.5 py-2 text-[13.5px]",
  sm: "px-3 py-1.5 text-[12.5px]",
};

/** Clases de botón, para usar también en `<Link>`. */
export function claseBoton(variante: VarianteBoton = "secundario", tamano: keyof typeof TAMANOS = "md"): string {
  return `inline-flex items-center justify-center gap-2 rounded-[5px] border transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTES[variante]} ${TAMANOS[tamano]}`;
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBoton;
  tamano?: keyof typeof TAMANOS;
}

export function Button({ variante, tamano, className = "", type = "button", ...props }: Props) {
  return <button type={type} className={`${claseBoton(variante, tamano)} ${className}`} {...props} />;
}
