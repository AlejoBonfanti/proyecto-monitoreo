import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { getAlertas, type FiltroAlertas } from "@/features/alertas/api";
import { AlertaItem } from "@/features/alertas/components/alerta-item";
import { TabsAlertas } from "@/features/alertas/components/tabs-alertas";
import { ordenarAlertas } from "@/features/alertas/utils";
import { ahora as reloj } from "@/lib/fechas";

export const metadata: Metadata = { title: "Alertas" };

export default async function AlertasPage({ searchParams }: PageProps<"/alertas">) {
  const { estado } = await searchParams;
  const filtro: FiltroAlertas = estado === "resuelta" ? "resuelta" : "abierta";
  const alertas = ordenarAlertas(await getAlertas({ estado: filtro }));
  const ahora = reloj();

  return (
    <>
      <PageHeader titulo="Alertas" subtitulo="Todos los galpones asignados" />
      <TabsAlertas actual={filtro} />
      {alertas.length === 0 ? (
        <p className="rounded-md border border-line bg-surface px-4 py-6 text-center text-[13px] text-ink-muted">
          {filtro === "abierta" ? "No hay alertas activas." : "Todavía no hay alertas resueltas."}
        </p>
      ) : (
        <ul className="grid gap-2">
          {alertas.map((a) => (
            <AlertaItem key={a.id} alerta={a} ahora={ahora} />
          ))}
        </ul>
      )}
    </>
  );
}
