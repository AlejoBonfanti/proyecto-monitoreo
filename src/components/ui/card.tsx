export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-md border border-line bg-surface px-5 py-[18px] ${className}`}>{children}</section>;
}

export function CardTitulo({ children }: { children: React.ReactNode }) {
  return <p className="mb-3 text-xs font-semibold uppercase tracking-[0.03em] text-ink-muted">{children}</p>;
}
