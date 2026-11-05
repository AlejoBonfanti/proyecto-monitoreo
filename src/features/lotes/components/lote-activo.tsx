import { Card } from "@/components/ui/card";
import { EstadoOperativoBadge } from "@/features/galpones/components/estado-operativo-badge";
import type { Galpon } from "@/features/galpones/types";
import { diasEntre, formatearFecha, formatearNumero } from "@/lib/format";
import { FinalizarLote } from "./finalizar-lote";

function Dato({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-[0.03em] text-ink-muted">{label}</dt>
      <dd className="mt-0.5 font-mono text-[15px]">{valor}</dd>
    </div>
  );
}

export function LoteActivo({ galpon }: { galpon: Galpon }) {
  const lote = galpon.loteActivo;
  return (
    <Card className="mb-4">
      <div className="mb-2 flex items-center justify-between">
        <strong className="text-[14.5px] font-semibold">
          Lote activo{lote?.numero ? ` #${lote.numero}` : ""}
        </strong>
        <EstadoOperativoBadge estado={galpon.estadoOperativo} />
      </div>
      {lote ? (
        <>
          <dl className="mt-4 mb-[18px] grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Dato label="Inicio" valor={formatearFecha(lote.fechaInicio)} />
            <Dato label="Día de vida" valor={`${lote.edadDias} de ${diasEntre(lote.fechaInicio, lote.fechaFinEstimada)}`} />
            <Dato label="Aves iniciales" valor={formatearNumero(lote.cantidadAvesInicial)} />
            <Dato label="Fin estimado" valor={formatearFecha(lote.fechaFinEstimada)} />
          </dl>
          <FinalizarLote loteId={lote.id} />
        </>
      ) : (
        <p className="text-[13px] text-ink-muted">Este galpón no tiene un lote activo.</p>
      )}
    </Card>
  );
}
