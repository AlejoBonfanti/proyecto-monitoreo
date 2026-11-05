import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { UsuarioAdmin } from "../types";

const TH = "border-b border-line py-2 pr-3 text-left text-[11.5px] font-medium uppercase tracking-[0.03em] text-ink-muted";
const TD = "border-b border-line py-3 pr-3 align-top";

function galponesDe(u: UsuarioAdmin): string {
  if (u.rol === "admin") return "Todos";
  return u.galpones.length ? u.galpones.map((g) => g.nombre).join(", ") : "Sin asignar";
}

export function ListaUsuarios({ usuarios, yo }: { usuarios: UsuarioAdmin[]; yo: number }) {
  return (
    <div className="overflow-x-auto rounded-md border border-line bg-surface px-5 py-2">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            <th className={TH}>Usuario</th>
            <th className={TH}>Rol</th>
            <th className={TH}>Galpones</th>
            <th className={TH}>Teléfono (SMS)</th>
            <th className={TH}>Estado</th>
            <th className={TH}>
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {usuarios.map((u) => (
            <tr key={u.id} className={u.activo ? "" : "opacity-55"}>
              <td className={TD}>
                <span className="block font-semibold">
                  {u.nombre}
                  {u.id === yo && <span className="ml-1.5 font-normal text-ink-muted">(vos)</span>}
                </span>
                <span className="block text-xs text-ink-muted">{u.email}</span>
              </td>
              <td className={TD}>
                <Badge tono={u.rol === "admin" ? "ok" : "muted"}>{u.rol === "admin" ? "Admin" : "Encargado"}</Badge>
              </td>
              <td className={TD}>{galponesDe(u)}</td>
              <td className={`${TD} font-mono text-[12.5px]`}>{u.telefono ?? <span className="font-sans text-ink-faint">—</span>}</td>
              <td className={TD}>{u.activo ? "Activo" : "Dado de baja"}</td>
              <td className={`${TD} text-right`}>
                <Link href={`/usuarios/${u.id}`} className="text-[13px] font-medium text-accent hover:underline">
                  Editar
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
