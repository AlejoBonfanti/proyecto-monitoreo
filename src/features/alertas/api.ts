import "server-only";
import { api } from "@/lib/api-client";
import type { Alerta } from "./types";

export type FiltroAlertas = "abierta" | "resuelta";

export function getAlertas(filtro: { estado?: FiltroAlertas; galponId?: number } = {}): Promise<Alerta[]> {
  return api<Alerta[]>("/alertas", { query: { estado: filtro.estado, galponId: filtro.galponId } });
}

export function reconocer(id: string): Promise<Alerta> {
  return api<Alerta>(`/alertas/${id}/reconocer`, { method: "PATCH" });
}

export function resolver(id: string): Promise<Alerta> {
  return api<Alerta>(`/alertas/${id}/resolver`, { method: "PATCH" });
}
