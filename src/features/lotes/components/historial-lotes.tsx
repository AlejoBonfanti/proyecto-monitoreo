import { Card, CardTitulo } from "@/components/ui/card";
import { diasEntre, formatearFecha, formatearNumero } from "@/lib/format";
import type { Lote } from "../types";

const TH = "border-b border-line py-1.5 text-[11.5px] font-medium uppercase tracking-[0.03em] text-ink-muted";
const TD = "border-b border-line py-2.5";

export function HistorialLotes({ lotes }: { lotes: Lote[] }) {
  const cerrados = lotes.filter((l) => l.estado === "finalizado");
  return (
    <Card className="mb-4">
      <CardTitulo>Historial de lotes</CardTitulo>
      {cerrados.length === 0 ? (
        <p className="text-[13px] text-ink-muted">Sin lotes anteriores.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th className={`${TH} text-left`}>Lote</th>
                <th className={`${TH} text-left`}>Inicio</th>
                <th className={`${TH} text-left`}>Duración</th>
                <th className={`${TH} text-right`}>Aves</th>
              </tr>
            </thead>
            <tbody className="font-mono text-[12.5px]">
              {cerrados.map((l) => (
                <tr key={l.id}>
                  <td className={TD}>{l.numero ? `#${l.numero}` : "—"}</td>
                  <td className={TD}>{formatearFecha(l.fechaInicio)}</td>
                  <td className={TD}>
                    {l.fechaFinReal ? `${diasEntre(l.fechaInicio, l.fechaFinReal)} días` : "—"}
                  </td>
                  <td className={`${TD} text-right`}>{formatearNumero(l.cantidadAvesInicial)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
