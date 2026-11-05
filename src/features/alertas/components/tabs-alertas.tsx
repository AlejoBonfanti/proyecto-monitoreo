import Link from "next/link";
import type { FiltroAlertas } from "../api";

const TABS: { valor: FiltroAlertas; label: string }[] = [
  { valor: "abierta", label: "Activas" },
  { valor: "resuelta", label: "Resueltas" },
];

export function TabsAlertas({ actual }: { actual: FiltroAlertas }) {
  return (
    <div role="tablist" className="mb-4 flex gap-2">
      {TABS.map((t) => (
        <Link
          key={t.valor}
          role="tab"
          aria-selected={t.valor === actual}
          href={t.valor === "abierta" ? "/alertas" : `/alertas?estado=${t.valor}`}
          className={`rounded-[5px] border px-3.5 py-1.5 text-[13px] ${
            t.valor === actual ? "border-ink bg-ink text-white" : "border-line bg-surface hover:bg-surface-muted"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
