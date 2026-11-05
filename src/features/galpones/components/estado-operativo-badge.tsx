import { Badge } from "@/components/ui/badge";
import type { EstadoOperativo } from "../types";

const ETIQUETA: Record<EstadoOperativo, string> = {
  produccion: "Producción",
  limpieza: "Limpieza",
  disponible: "Disponible",
};

export function EstadoOperativoBadge({ estado }: { estado: EstadoOperativo }) {
  return <Badge tono={estado === "produccion" ? "ok" : "muted"}>{ETIQUETA[estado]}</Badge>;
}
