"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import type { RangoLecturas } from "../types";

const OPCIONES: { valor: RangoLecturas; label: string }[] = [
  { valor: "24h", label: "Últimas 24h" },
  { valor: "7d", label: "7 días" },
  { valor: "lote", label: "Lote completo" },
];

/** Cambia `?rango=` en la URL; la página vuelve a pedir las lecturas en el servidor. */
export function SelectorRango({ valor, conLote }: { valor: RangoLecturas; conLote: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [cargando, startTransition] = useTransition();

  return (
    <select
      value={valor}
      aria-label="Rango de tiempo"
      aria-busy={cargando}
      disabled={cargando}
      onChange={(e) => {
        const nuevos = new URLSearchParams(params);
        nuevos.set("rango", e.target.value);
        startTransition(() => router.replace(`${pathname}?${nuevos}`, { scroll: false }));
      }}
      className="rounded-[5px] border border-line bg-surface px-2.5 py-[7px] text-[13px] disabled:opacity-60"
    >
      {OPCIONES.filter((o) => o.valor !== "lote" || conLote).map((o) => (
        <option key={o.valor} value={o.valor}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
