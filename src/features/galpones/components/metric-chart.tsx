import { META_METRICA } from "@/features/metricas/metricas";
import type { Metrica, Severidad, Umbrales } from "@/features/metricas/types";
import { formatearValor } from "@/lib/format";
import type { PuntoLectura } from "../types";

const W = 260;
const H = 80;
const PAD = 6;

const COLOR: Record<Severidad, string> = {
  ok: "var(--color-accent)",
  warning: "var(--color-warn)",
  critica: "var(--color-danger)",
};
const CLASE_NOTA: Record<Severidad, string> = { ok: "text-ink-muted", warning: "text-warn", critica: "text-danger" };

interface Props {
  metrica: Metrica;
  puntos: PuntoLectura[];
  umbrales?: Umbrales;
  /** Severidad de la lectura actual, calculada por la API. */
  severidad: Severidad | null;
  /** Versión reducida para grillas (vista de granja): más baja, título corto y solo el valor actual. */
  compacto?: boolean;
}

/** "normal 24–28 °C · crítico ≥31" */
function describirUmbrales(metrica: Metrica, u: Umbrales): string {
  const partes: string[] = [];
  if (u.minWarning !== null && u.maxWarning !== null) partes.push(`normal ${u.minWarning}–${u.maxWarning} ${META_METRICA[metrica].unidad}`);
  else if (u.maxWarning !== null) partes.push(`normal <${u.maxWarning} ${META_METRICA[metrica].unidad}`);
  if (u.maxCritico !== null) partes.push(`crítico ≥${u.maxCritico}`);
  return partes.join(" · ");
}

export function MetricChart({ metrica, puntos, umbrales, severidad, compacto = false }: Props) {
  const meta = META_METRICA[metrica];
  const actual = puntos.at(-1)?.valor;
  const sev = severidad ?? "ok";

  const lineas = umbrales
    ? [
        { v: umbrales.minWarning, color: COLOR.warning },
        { v: umbrales.maxWarning, color: COLOR.warning },
        { v: umbrales.minCritico, color: COLOR.critica },
        { v: umbrales.maxCritico, color: COLOR.critica },
      ].filter((l): l is { v: number; color: string } => l.v !== null)
    : [];

  // Dominio Y: entra la serie completa; los umbrales solo si están cerca, para no aplastar la curva.
  const valores = puntos.map((p) => p.valor);
  let min = Math.min(...valores);
  let max = Math.max(...valores);
  const rango = max - min || Math.abs(max) * 0.1 || 1;
  for (const l of lineas) {
    if (l.v >= min - rango * 1.5 && l.v <= max + rango * 1.5) {
      min = Math.min(min, l.v);
      max = Math.max(max, l.v);
    }
  }
  const margen = (max - min) * 0.12 || 1;
  min -= margen;
  max += margen;

  const x = (i: number) => (puntos.length > 1 ? (i / (puntos.length - 1)) * W : W / 2);
  const y = (v: number) => PAD + (1 - (v - min) / (max - min)) * (H - PAD * 2);
  const trazo = puntos.map((p, i) => `${x(i).toFixed(1)},${y(p.valor).toFixed(1)}`).join(" ");
  const visibles = lineas.filter((l) => l.v >= min && l.v <= max);

  const detalle =
    sev === "critica"
      ? "sobre umbral crítico"
      : sev === "warning"
        ? "fuera del rango normal"
        : umbrales
          ? describirUmbrales(metrica, umbrales)
          : "sin regla vigente";

  const alto = compacto ? "h-10" : "h-20";

  return (
    <figure className={compacto ? "rounded-[5px] border border-line bg-surface px-2 py-1.5" : "rounded-md border border-line bg-surface px-4 py-3.5"}>
      {compacto ? (
        <figcaption className="mb-1 flex items-baseline justify-between gap-1 text-[10.5px] uppercase tracking-[0.04em] text-ink-muted">
          {meta.corto}
          <span className={`font-mono text-[11px] font-semibold normal-case tracking-normal ${sev === "ok" ? "text-ink" : CLASE_NOTA[sev]}`}>
            {actual !== undefined ? formatearValor(metrica, actual) : "—"}
          </span>
        </figcaption>
      ) : (
        <figcaption className="mb-2 text-[12.5px] text-ink-muted">
          {meta.nombre} ({meta.unidad})
        </figcaption>
      )}
      {puntos.length === 0 ? (
        <div className={`flex ${alto} items-center justify-center text-xs text-ink-faint`}>{compacto ? "Sin datos" : "Sin lecturas en el rango"}</div>
      ) : (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className={`${alto} w-full`}
          role="img"
          aria-label={`${meta.nombre}: valor actual ${actual !== undefined ? formatearValor(metrica, actual) : "sin datos"}`}
        >
          {visibles.map((l, i) => (
            <line key={i} x1={0} x2={W} y1={y(l.v)} y2={y(l.v)} stroke={l.color} strokeWidth={1} strokeDasharray="3,3" vectorEffect="non-scaling-stroke" />
          ))}
          <polyline points={trazo} fill="none" stroke={COLOR[sev]} strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
      )}
      {!compacto && (
        <p className={`mt-2 font-mono text-[11px] ${CLASE_NOTA[sev]}`}>
          {actual !== undefined ? `actual ${formatearValor(metrica, actual)} · ${detalle}` : detalle}
        </p>
      )}
    </figure>
  );
}
