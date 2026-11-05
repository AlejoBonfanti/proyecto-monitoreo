/** Mensaje de error general de un formulario. */
export function MensajeError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-[5px] bg-danger-bg px-3 py-2 text-[12.5px] text-danger">
      {children}
    </p>
  );
}
