import { describe, expect, it } from "vitest";
import { firmarSesion, verificarSesion } from "./session-token";
import type { Sesion } from "./types";

const sesion: Sesion = {
  usuario: { id: 2, nombre: "Esteban Martínez", email: "encargado@carnave.com", rol: "encargado" },
  apiToken: "token-de-la-api",
};

describe("sesión", () => {
  it("firma y verifica la sesión", async () => {
    const token = await firmarSesion(sesion);
    expect(await verificarSesion(token)).toEqual(sesion);
  });

  it("rechaza tokens alterados, vacíos o basura", async () => {
    const token = await firmarSesion(sesion);
    const [h, p, s] = token.split(".");
    const alterado = [h, Buffer.from(JSON.stringify({ ...sesion, usuario: { ...sesion.usuario, rol: "admin" } })).toString("base64url"), s].join(".");
    expect(p).toBeTruthy();
    expect(await verificarSesion(alterado)).toBeNull();
    expect(await verificarSesion(undefined)).toBeNull();
    expect(await verificarSesion("no-es-un-jwt")).toBeNull();
  });
});
