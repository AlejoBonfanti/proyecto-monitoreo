import { describe, expect, it } from "vitest";
import { fechaAR, hoyISO, inicioDelDia, sumarDias } from "./fechas";

describe("fechas en hora argentina", () => {
  it("hoy es el día de Argentina aunque en UTC ya sea mañana", () => {
    // 22:30 del 28/09 en Argentina = 01:30 del 29/09 en UTC.
    expect(hoyISO(new Date("2026-09-29T01:30:00Z"))).toBe("2026-09-28");
    expect(hoyISO(new Date("2026-09-29T03:00:00Z"))).toBe("2026-09-29");
    expect(fechaAR(new Date("2026-09-28T12:00:00-03:00"))).toBe("2026-09-28");
  });

  it("el día empieza a las 00:00 de Argentina", () => {
    expect(inicioDelDia("2026-09-10").toISOString()).toBe("2026-09-10T03:00:00.000Z");
  });

  it("suma días cruzando meses", () => {
    expect(sumarDias("2026-09-28", 45)).toBe("2026-11-12");
    expect(sumarDias("2026-03-01", -1)).toBe("2026-02-28");
  });
});
