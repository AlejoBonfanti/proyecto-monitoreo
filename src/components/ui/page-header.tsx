import Link from "next/link";

interface Props {
  titulo: string;
  subtitulo?: React.ReactNode;
  /** Link de "volver" arriba del título. */
  volver?: { href: string; label: string };
  /** Controles alineados a la derecha (filtros, botones). */
  acciones?: React.ReactNode;
}

export function PageHeader({ titulo, subtitulo, volver, acciones }: Props) {
  return (
    <div className="mb-6">
      {volver && (
        <Link href={volver.href} className="mb-3 inline-block text-[12.5px] text-ink-muted hover:text-ink">
          ← {volver.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="mb-1 text-[19px] font-semibold">{titulo}</h1>
          {subtitulo && <p className="text-[13.5px] text-ink-muted">{subtitulo}</p>}
        </div>
        {acciones}
      </div>
    </div>
  );
}
