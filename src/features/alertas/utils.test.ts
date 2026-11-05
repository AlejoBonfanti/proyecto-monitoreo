import { describe, expect, it } from "vitest";
import { ordenarAlertas, sinAtender, tituloAlerta } from "./utils";

describe("alertas", () => {
  it("solo activas y escaladas están sin atender", () => {
    expect(sinAtender({ estado: "activa" })).toBe(true);
    expect(sinAtender({ estado: "escalada" })).toBe(true);
    expect(sinAtender({ estado: "reconocida" })).toBe(false);
    expect(sinAtender({ estado: "resuelta" })).toBe(false);
  });

  it("ordena: sin atender, críticas y más recientes primero", () => {
    const a = (id: number, estado: "activa" | "reconocida", severidad: "warning" | "critica", fechaDisparo: string) => ({ id, estado, severidad, fechaDisparo });
    const orden = ordenarAlertas([
      a(1, "reconocida", "critica", "2026-09-28T10:00:00Z"),
      a(2, "activa", "warning", "2026-09-28T11:00:00Z"),
      a(3, "activa", "critica", "2026-09-28T09:00:00Z"),
      a(4, "activa", "warning", "2026-09-28T12:00:00Z"),
    ]).map((x) => x.id);
    expect(orden).toEqual([3, 4, 2, 1]);
  });
});

describe("tituloAlerta", () => {
  const galpon = { id: 1, nombre: "Galpón 1" };

  it("nombra la métrica o el problema del equipo según el tipo", () => {
    expect(tituloAlerta({ tipo: "ambiental", galpon, metrica: "co2" })).toBe("Galpón 1 · CO2");
    expect(tituloAlerta({ tipo: "nodo_caido", galpon, metrica: null })).toBe("Galpón 1 · Nodo sin conexión");
    expect(tituloAlerta({ tipo: "dato_retrasado", galpon, metrica: "amoniaco" })).toBe("Galpón 1 · Sin datos de Amoníaco");
  });
});
