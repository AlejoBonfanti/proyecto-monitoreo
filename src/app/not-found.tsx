import Link from "next/link";
import { claseBoton } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="mb-2 text-[19px] font-semibold">No encontramos esa página</h1>
      <p className="mb-6 text-[13.5px] text-ink-muted">Puede que no exista o que no tengas acceso a ese galpón.</p>
      <Link href="/" className={claseBoton("primario")}>
        Volver al dashboard
      </Link>
    </main>
  );
}
