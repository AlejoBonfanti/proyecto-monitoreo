import { describe, expect, it } from "vitest";
import { editarUsuarioSchema, nuevoUsuarioSchema } from "./schemas";

const valido = {
  nombre: " Juan Pérez ",
  email: "Juan@Carnave.com ",
  rol: "encargado",
  password: "segura123",
  telefono: "+54 9 3496 123-456",
  galponIds: ["1", "2"],
};

describe("nuevoUsuarioSchema", () => {
  it("normaliza nombre, email, teléfono y galpones", () => {
    expect(nuevoUsuarioSchema.parse(valido)).toEqual({
      nombre: "Juan Pérez",
      email: "juan@carnave.com",
      rol: "encargado",
      password: "segura123",
      telefono: "+5493496123456",
      galponIds: [1, 2],
    });
  });

  it("teléfono vacío = sin SMS", () => {
    expect(nuevoUsuarioSchema.parse({ ...valido, telefono: "" }).telefono).toBeNull();
  });

  it("el admin no lleva galpones asignados", () => {
    expect(nuevoUsuarioSchema.parse({ ...valido, rol: "admin" }).galponIds).toEqual([]);
  });

  it.each([
    [{ nombre: "" }, "nombre"],
    [{ email: "no-es-email" }, "email"],
    [{ rol: "supervisor" }, "rol"],
    [{ password: "corta" }, "password"],
    [{ telefono: "3496123456" }, "telefono"], // falta +código de país
  ])("rechaza %o", (cambio, campo) => {
    const r = nuevoUsuarioSchema.safeParse({ ...valido, ...cambio });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual([campo]);
  });
});

describe("editarUsuarioSchema", () => {
  it("contraseña vacía = no se cambia", () => {
    expect(editarUsuarioSchema.parse({ ...valido, password: "" }).password).toBeUndefined();
  });

  it("si se escribe una contraseña, se valida", () => {
    expect(editarUsuarioSchema.safeParse({ ...valido, password: "corta" }).success).toBe(false);
  });
});
