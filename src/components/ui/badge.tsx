export type TonoBadge = "ok" | "warn" | "danger" | "muted";

const TONOS: Record<TonoBadge, string> = {
  ok: "bg-accent-bg text-accent",
  warn: "bg-warn-bg text-warn",
  danger: "bg-danger-bg text-danger",
  muted: "bg-surface-muted text-ink-muted",
};

export function Badge({ tono, children }: { tono: TonoBadge; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded px-2.5 py-0.5 text-[11.5px] font-semibold tracking-[0.01em] ${TONOS[tono]}`}
    >
      {children}
    </span>
  );
}
