import { describe, expect, it } from "vitest";
import { diasEntre, formatearFecha, formatearFechaCorta, formatearNumero, formatearValor, nombreCorto, pluralizar, tiempoRelativo } from "./format";

describe("formatearValor", () => {
  it("usa los decimales y la unidad de cada métrica", () => {
    expect(formatearValor("temperatura", 27.44)).toBe("27.4 °C");
    expect(formatearValor("humedad", 61.2)).toBe("61 %");
    expect(formatearValor("co2", 2850)).toBe("2850 ppm");
    expect(formatearValor("amoniaco", 9)).toBe("9 ppm");
  });
});

describe("fechas", () => {
  it("formatea fechas y timestamps ISO", () => {
    expect(formatearFecha("2026-08-24")).toBe("24/08/2026");
    expect(formatearFecha("2026-08-24T15:30:00Z")).toBe("24/08/2026");
    // 01:30 UTC del 25 son las 22:30 del 24 en Argentina.
    expect(formatearFecha("2026-08-25T01:30:00Z")).toBe("24/08/2026");
    expect(formatearFechaCorta("2026-08-24")).toBe("24/08");
  });

  it("cuenta días entre fechas, incluso cruzando meses", () => {
    expect(diasEntre("2026-08-24", "2026-10-08")).toBe(45);
    expect(diasEntre("2026-09-28", "2026-09-28")).toBe(0);
  });
});

describe("tiempoRelativo", () => {
  const ahora = new Date("2026-09-28T12:00:00Z");
  const hace = (min: number) => new Date(ahora.getTime() - min * 60_000).toISOString();

  it.each([
    [0, "recién"],
    [6, "hace 6 min"],
    [59, "hace 59 min"],
    [120, "hace 2 h"],
    [60 * 24, "hace 1 día"],
    [60 * 48, "hace 2 días"],
  ])("%i min → %s", (min, esperado) => {
    expect(tiempoRelativo(hace(min), ahora)).toBe(esperado);
  });
});

describe("textos", () => {
  it("abrevia nombres", () => {
    expect(nombreCorto("Esteban Martínez")).toBe("E. Martínez");
    expect(nombreCorto("Admin")).toBe("Admin");
  });

  it("formatea números y plurales en es-AR", () => {
    expect(formatearNumero(12400)).toBe("12.400");
    expect(pluralizar(1, "ave")).toBe("1 ave");
    expect(pluralizar(12400, "ave")).toBe("12.400 aves");
  });
});
