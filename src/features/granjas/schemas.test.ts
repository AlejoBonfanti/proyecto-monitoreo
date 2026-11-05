import { describe, expect, it } from "vitest";
import { galponSchema, granjaSchema } from "./schemas";

describe("granjaSchema", () => {
  it("normaliza nombre y ubicación", () => {
    expect(granjaSchema.parse({ nombre: "  Granja Norte ", ubicacion: " Rafaela " })).toEqual({ nombre: "Granja Norte", ubicacion: "Rafaela" });
  });

  it("ubicación vacía = null", () => {
    expect(granjaSchema.parse({ nombre: "Granja Norte", ubicacion: "  " }).ubicacion).toBeNull();
  });

  it.each([
    [{ nombre: "   " }, "nombre"],
    [{ nombre: "x".repeat(101) }, "nombre"],
    [{ ubicacion: "x".repeat(201) }, "ubicacion"],
  ])("rechaza %o", (cambio, campo) => {
    const r = granjaSchema.safeParse({ nombre: "Granja Norte", ubicacion: "", ...cambio });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual([campo]);
  });
});

describe("galponSchema", () => {
  it("recorta el nombre y exige que no esté vacío", () => {
    expect(galponSchema.parse({ nombre: " Galpón 3 " })).toEqual({ nombre: "Galpón 3" });
    expect(galponSchema.safeParse({ nombre: "  " }).success).toBe(false);
  });
});
