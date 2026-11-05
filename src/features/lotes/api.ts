import "server-only";
import { api } from "@/lib/api-client";
import type { Lote, NuevoLote } from "./types";

export function getLotes(galponId: number): Promise<Lote[]> {
  return api<Lote[]>(`/galpones/${galponId}/lotes`);
}

export function crear(galponId: number, lote: NuevoLote): Promise<Lote> {
  return api<Lote>(`/galpones/${galponId}/lotes`, { method: "POST", body: lote });
}

export function finalizar(loteId: number): Promise<Lote> {
  return api<Lote>(`/lotes/${loteId}/finalizar`, { method: "PATCH" });
}
