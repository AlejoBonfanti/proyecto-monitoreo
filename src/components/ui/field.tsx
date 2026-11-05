import type { InputHTMLAttributes } from "react";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  name: string;
  error?: string;
  ayuda?: string;
}

/** Label + input + mensaje de error, accesible (aria-invalid / aria-describedby). */
export function Field({ label, name, error, ayuda, id = name, className = "", ...props }: Props) {
  const idMensaje = `${id}-mensaje`;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-[5px] block text-[12.5px] text-ink-muted">
        {label}
      </label>
      <input
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || ayuda ? idMensaje : undefined}
        className={`w-full rounded-[5px] border bg-surface px-[11px] py-[9px] text-[13.5px] text-ink focus:border-accent focus:shadow-[0_0_0_3px_var(--color-accent-bg)] focus:outline-none ${
          error ? "border-danger" : "border-line"
        }`}
        {...props}
      />
      {(error || ayuda) && (
        <p id={idMensaje} className={`mt-1 text-xs ${error ? "text-danger" : "text-ink-faint"}`}>
          {error ?? ayuda}
        </p>
      )}
    </div>
  );
}
