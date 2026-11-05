import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { getGalpones } from "@/features/galpones/api";
import { GalponCard } from "@/features/galpones/components/galpon-card";
import type { Galpon } from "@/features/galpones/types";
import { ahora as reloj } from "@/lib/fechas";

export const metadata: Metadata = { title: "Mis galpones" };

export default async function DashboardPage() {
  const galpones = await getGalpones();
  const ahora = reloj();

  // Agrupados por granja (un encargado suele tener una; un admin ve todas).
  const porGranja = new Map<string, Galpon[]>();
  for (const g of galpones) porGranja.set(g.granja.nombre, [...(porGranja.get(g.granja.nombre) ?? []), g]);
  const unaSola = porGranja.size === 1;

  return (
    <>
      <PageHeader titulo="Mis galpones" subtitulo={unaSola ? [...porGranja.keys()][0] : `${porGranja.size} granjas`} />
      {galpones.length === 0 && (
        <p className="rounded-md border border-line bg-surface px-4 py-6 text-center text-[13px] text-ink-muted">
          No tenés galpones asignados. Pedile a un administrador que te asigne.
        </p>
      )}
      {[...porGranja].map(([granja, lista]) => (
        <section key={granja} className="mb-8">
          {!unaSola && <h2 className="mb-3 text-[13px] font-semibold text-ink-muted">{granja}</h2>}
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
            {lista.map((g) => (
              <GalponCard key={g.id} galpon={g} ahora={ahora} />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
