import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nuevoLoteSchema } from "./schemas";

const valido = { numero: "", fechaInicio: "2026-09-28", fechaFinEstimada: "2026-11-12", cantidadAvesInicial: "12400" };

describe("nuevoLoteSchema", () => {
  // "Hoy" fijo: 28/09/2026 a las 22:30 en Argentina (en UTC ya es 29/09).
  beforeEach(() => vi.useFakeTimers({ now: new Date("2026-09-29T01:30:00Z") }));
  afterEach(() => vi.useRealTimers());

  it("acepta un lote válido y convierte tipos del formulario", () => {
    expect(nuevoLoteSchema.parse(valido)).toEqual({
      numero: null,
      fechaInicio: "2026-09-28",
      fechaFinEstimada: "2026-11-12",
      cantidadAvesInicial: 12400,
    });
  });

  it("el número de lote es opcional y se recorta", () => {
    expect(nuevoLoteSchema.parse({ ...valido, numero: "  14 " }).numero).toBe("14");
  });

  it.each([
    [{ cantidadAvesInicial: "0" }, "cantidadAvesInicial"],
    [{ cantidadAvesInicial: "12.5" }, "cantidadAvesInicial"],
    [{ fechaInicio: "28/09/2026" }, "fechaInicio"],
    [{ fechaFinEstimada: "2026-09-01" }, "fechaFinEstimada"],
    [{ numero: "x".repeat(21) }, "numero"],
    [{ fechaInicio: "2026-09-29", fechaFinEstimada: "2026-11-13" }, "fechaInicio"], // mañana en Argentina
  ])("rechaza %o", (cambio, campo) => {
    const r = nuevoLoteSchema.safeParse({ ...valido, ...cambio });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual([campo]);
  });
});
