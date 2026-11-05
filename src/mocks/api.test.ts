/**
 * Contrato de la API simulada. Documenta las reglas de negocio que el backend
 * real tiene que cumplir (docs/01-requisitos-funcionales.md, 03-modelo-datos.md).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Alerta } from "@/features/alertas/types";
import type { LoginRespuesta } from "@/features/auth/types";
import type { Galpon } from "@/features/galpones/types";
import type { GalponAdmin, GranjaAdmin } from "@/features/granjas/types";
import type { Lote } from "@/features/lotes/types";
import type { UsuarioAdmin } from "@/features/usuarios/types";
import { mockFetch } from "./api";
import { PASSWORD_DEMO, uuidDemo } from "./datos";
import { db, reiniciarDb } from "./db";
import { evaluarSeveridad, reglaVigente } from "./motor";

async function llamar<T>(ruta: string, opciones: { method?: string; body?: unknown; token?: string } = {}) {
  const res = await mockFetch(ruta, {
    method: opciones.method ?? "GET",
    headers: opciones.token ? { Authorization: `Bearer ${opciones.token}` } : {},
    body: opciones.body === undefined ? undefined : JSON.stringify(opciones.body),
  });
  return { status: res.status, data: (await res.json()) as T };
}

async function tokenDe(email: string) {
  const { data } = await llamar<LoginRespuesta>("/auth/login", { method: "POST", body: { email, password: PASSWORD_DEMO } });
  return data.token;
}

/**
 * Fija el reloj (el que usa la API simulada para "ahora" y "hoy") y reinicia la base en esa fecha.
 * Fechas siempre con zona explícita: el resultado no depende de la zona ni del día en que se corren los tests.
 */
function fijarReloj(instante: string) {
  vi.useFakeTimers({ toFake: ["Date"], now: new Date(instante) });
  reiniciarDb(new Date(instante));
}

beforeEach(() => fijarReloj("2026-09-28T12:00:00-03:00"));
afterEach(() => vi.useRealTimers());

describe("auth", () => {
  it("login correcto devuelve token y usuario, sin contraseña", async () => {
    const { status, data } = await llamar<LoginRespuesta>("/auth/login", { method: "POST", body: { email: "ADMIN@carnave.com ", password: PASSWORD_DEMO } });
    expect(status).toBe(200);
    expect(data.usuario).toEqual({ id: 1, nombre: "Administrador Carnave", email: "admin@carnave.com", rol: "admin" });
    expect(JSON.stringify(data)).not.toContain(PASSWORD_DEMO);
  });

  it("credenciales inválidas → 401; sin token → 401", async () => {
    expect((await llamar("/auth/login", { method: "POST", body: { email: "admin@carnave.com", password: "x" } })).status).toBe(401);
    expect((await llamar("/galpones")).status).toBe(401);
  });
});

describe("permisos por rol", () => {
  it("el encargado solo ve sus galpones asignados; el admin ve todos", async () => {
    db().galpones.push({ id: 3, granjaId: 1, nombre: "Galpón 3", estadoOperativo: "disponible", fechaInicioLimpieza: null, fechaFinLimpiezaEstimada: null, activo: true });
    const encargado = await llamar<Galpon[]>("/galpones", { token: await tokenDe("encargado@carnave.com") });
    const admin = await llamar<Galpon[]>("/galpones", { token: await tokenDe("admin@carnave.com") });
    expect(encargado.data.map((g) => g.id)).toEqual([1, 2]);
    expect(admin.data.map((g) => g.id)).toEqual([1, 2, 3]);
    expect((await llamar("/galpones/3", { token: await tokenDe("encargado@carnave.com") })).status).toBe(404);
  });
});

describe("galpones y severidad", () => {
  it("en producción devuelve umbrales vigentes y severidad calculada", async () => {
    const { data } = await llamar<Galpon>("/galpones/1", { token: await tokenDe("encargado@carnave.com") });
    expect(data.loteActivo?.edadDias).toBe(18);
    expect(data.umbrales.temperatura).toEqual({ minWarning: 24, maxWarning: 28, minCritico: 22, maxCritico: 31 });
    expect(data.lecturas.find((l) => l.metrica === "co2")?.severidad).toBe("warning");
    expect(data.lecturas.find((l) => l.metrica === "temperatura")?.severidad).toBe("ok");
    expect(data.alertasSinAtender).toBe(2);
  });

  it("la edad del lote se cuenta en días de Argentina, aunque en UTC ya sea el día siguiente", async () => {
    fijarReloj("2026-09-29T01:30:00Z"); // 28/09 22:30 en Argentina
    db().lotes.find((l) => l.id === 13)!.fechaInicio = "2026-09-10";
    const { data } = await llamar<Galpon>("/galpones/1", { token: await tokenDe("encargado@carnave.com") });
    expect(data.loteActivo?.edadDias).toBe(18);
  });

  it("toda edad tiene regla: el último rango no tiene tope", () => {
    expect(reglaVigente(db(), "temperatura", 60, 1)?.id).toBe(3);
    expect(reglaVigente(db(), "co2", 120, 1)?.id).toBe(5);
  });

  it("fuera de producción no evalúa (severidad null, sin umbrales)", async () => {
    const { data } = await llamar<Galpon>("/galpones/2", { token: await tokenDe("encargado@carnave.com") });
    expect(data.umbrales).toEqual({});
    expect(data.lecturas.every((l) => l.severidad === null)).toBe(true);
  });

  it("la regla de granja gana sobre la global", () => {
    db().reglas.push({ id: 99, metrica: "co2", edadDesde: 0, edadHasta: null, minWarning: null, maxWarning: 3000, minCritico: null, maxCritico: 4000, granjaId: 1, activo: true });
    expect(reglaVigente(db(), "co2", 18, 1)?.id).toBe(99);
    expect(reglaVigente(db(), "co2", 18, 2)?.id).toBe(5); // otra granja no toma el override ajeno
  });

  it("evalúa severidad contra ambos umbrales", () => {
    const u = { minWarning: 24, maxWarning: 28, minCritico: 22, maxCritico: 31 };
    expect(evaluarSeveridad(27, u)).toBe("ok");
    expect(evaluarSeveridad(28.5, u)).toBe("warning");
    expect(evaluarSeveridad(23, u)).toBe("warning");
    expect(evaluarSeveridad(31, u)).toBe("critica");
    expect(evaluarSeveridad(21, u)).toBe("critica");
  });

  it("lecturas: valida el rango y termina en el valor actual", async () => {
    const token = await tokenDe("encargado@carnave.com");
    const ok = await llamar<{ metrica: string; puntos: { valor: number }[] }[]>(
      "/galpones/1/lecturas?desde=2026-09-27T12:00:00Z&hasta=2026-09-28T12:00:00Z",
      { token },
    );
    expect(ok.data).toHaveLength(4);
    expect(ok.data.find((s) => s.metrica === "co2")?.puntos.at(-1)?.valor).toBe(2850);
    expect((await llamar("/galpones/1/lecturas?desde=2026-09-28T12:00:00Z&hasta=2026-09-27T12:00:00Z", { token })).status).toBe(400);
  });
});

describe("ciclo de vida del lote", () => {
  it("limpieza → disponible → producción (al crear lote) → limpieza (al finalizar)", async () => {
    const token = await tokenDe("encargado@carnave.com");
    const nuevo = { numero: "14", fechaInicio: "2026-09-28", fechaFinEstimada: "2026-11-12", cantidadAvesInicial: 11800 };

    expect((await llamar("/galpones/2/estado", { method: "PATCH", body: { estadoOperativo: "disponible" }, token })).status).toBe(200);

    const creado = await llamar<Lote>("/galpones/2/lotes", { method: "POST", body: nuevo, token });
    expect(creado.status).toBe(201);
    expect(creado.data).toMatchObject({ numero: "14", estado: "activo" });
    expect((await llamar<Galpon>("/galpones/2", { token })).data.estadoOperativo).toBe("produccion");

    // Máximo un lote activo por galpón.
    expect((await llamar("/galpones/2/lotes", { method: "POST", body: nuevo, token })).status).toBe(409);

    const fin = await llamar<Lote>(`/lotes/${creado.data.id}/finalizar`, { method: "PATCH", token });
    expect(fin.data).toMatchObject({ estado: "finalizado", fechaFinReal: "2026-09-28" });
    const enLimpieza = (await llamar<Galpon>("/galpones/2", { token })).data;
    expect(enLimpieza.estadoOperativo).toBe("limpieza");
    expect(enLimpieza.limpieza).toEqual({ fechaInicio: "2026-09-28", fechaFinEstimada: "2026-10-13" });

    await llamar("/galpones/2/estado", { method: "PATCH", body: { estadoOperativo: "disponible" }, token });
    expect((await llamar<Galpon>("/galpones/2", { token })).data.limpieza).toBeNull();
  });

  it("cargar un lote en un galpón en limpieza termina la limpieza automáticamente (decisión #33)", async () => {
    const token = await tokenDe("encargado@carnave.com");
    expect((await llamar<Galpon>("/galpones/2", { token })).data.estadoOperativo).toBe("limpieza");
    const nuevo = { numero: "14", fechaInicio: "2026-09-28", fechaFinEstimada: "2026-11-12", cantidadAvesInicial: 11800 };
    expect((await llamar("/galpones/2/lotes", { method: "POST", body: nuevo, token })).status).toBe(201);
    const g = (await llamar<Galpon>("/galpones/2", { token })).data;
    expect(g.estadoOperativo).toBe("produccion");
    expect(g.limpieza).toBeNull();
  });

  it("el admin también puede iniciar y terminar lotes", async () => {
    const token = await tokenDe("admin@carnave.com");
    const nuevo = { numero: null, fechaInicio: "2026-09-28", fechaFinEstimada: "2026-11-12", cantidadAvesInicial: 100 };
    const creado = await llamar<Lote>("/galpones/2/lotes", { method: "POST", body: nuevo, token });
    expect(creado.status).toBe(201);
    expect((await llamar(`/lotes/${creado.data.id}/finalizar`, { method: "PATCH", token })).status).toBe(200);
  });

  it("no se puede crear un lote con fecha de inicio futura (día de Argentina)", async () => {
    fijarReloj("2026-09-29T01:30:00Z"); // 28/09 22:30 en Argentina
    const token = await tokenDe("encargado@carnave.com");
    await llamar("/galpones/2/estado", { method: "PATCH", body: { estadoOperativo: "disponible" }, token });
    const base = { numero: null, fechaFinEstimada: "2026-11-13", cantidadAvesInicial: 100 };
    expect((await llamar("/galpones/2/lotes", { method: "POST", body: { ...base, fechaInicio: "2026-09-29" }, token })).status).toBe(400);
    expect((await llamar("/galpones/2/lotes", { method: "POST", body: { ...base, fechaInicio: "2026-09-28" }, token })).status).toBe(201);
  });

  it("el número de lote es opcional", async () => {
    const token = await tokenDe("admin@carnave.com");
    await llamar("/galpones/2/estado", { method: "PATCH", body: { estadoOperativo: "disponible" }, token });
    const r = await llamar<Lote>("/galpones/2/lotes", {
      method: "POST",
      body: { numero: null, fechaInicio: "2026-09-28", fechaFinEstimada: "2026-11-12", cantidadAvesInicial: 100 },
      token,
    });
    expect(r.data.numero).toBeNull();
  });
});

describe("alertas", () => {
  it("filtra abiertas / resueltas", async () => {
    const token = await tokenDe("encargado@carnave.com");
    expect((await llamar<Alerta[]>("/alertas?estado=abierta", { token })).data.map((a) => a.id).sort()).toEqual([uuidDemo(1), uuidDemo(2), uuidDemo(3)]);
    expect((await llamar<Alerta[]>("/alertas?estado=resuelta", { token })).data.map((a) => a.id)).toEqual([uuidDemo(5), uuidDemo(4)]);
  });

  it("filtra por galpón con galponId (camelCase)", async () => {
    const token = await tokenDe("encargado@carnave.com");
    expect((await llamar<Alerta[]>("/alertas?galponId=2", { token })).data.map((a) => a.id)).toEqual([uuidDemo(5)]);
  });

  it("las alertas de salud del nodo no llevan métrica ni valor, y existen aunque el galpón no esté en producción", async () => {
    const token = await tokenDe("encargado@carnave.com");
    const [nodo] = (await llamar<Alerta[]>("/alertas?galponId=2", { token })).data;
    expect(nodo).toMatchObject({ tipo: "nodo_caido", metrica: null, valorLeido: null, severidad: "critica", resolucionAutomatica: true });
  });

  it("los ids de alerta son UUID", async () => {
    const token = await tokenDe("encargado@carnave.com");
    expect((await llamar("/alertas/2/reconocer", { method: "PATCH", token })).status).toBe(404);
    expect((await llamar(`/alertas/${uuidDemo(2).toUpperCase()}/reconocer`, { method: "PATCH", token })).status).toBe(200);
  });

  it("reconocer registra quién y cuándo; no se puede reconocer dos veces", async () => {
    const token = await tokenDe("encargado@carnave.com");
    const r = await llamar<Alerta>(`/alertas/${uuidDemo(2)}/reconocer`, { method: "PATCH", token });
    expect(r.data).toMatchObject({ estado: "reconocida", reconocidaPor: { id: 2, nombre: "Esteban Martínez" } });
    expect(r.data.fechaReconocimiento).not.toBeNull();
    expect((await llamar(`/alertas/${uuidDemo(2)}/reconocer`, { method: "PATCH", token })).status).toBe(409);
  });

  it("el encargado puede resolver (ciclo completo, decisión #9)", async () => {
    const token = await tokenDe("encargado@carnave.com");
    const r = await llamar<Alerta>(`/alertas/${uuidDemo(1)}/resolver`, { method: "PATCH", token });
    expect(r.data).toMatchObject({ estado: "resuelta", resueltaPor: { id: 2 }, resolucionAutomatica: false });
    expect((await llamar(`/alertas/${uuidDemo(1)}/resolver`, { method: "PATCH", token })).status).toBe(409);
  });
});

describe("usuarios (ABM, solo admin)", () => {
  const nuevo = { nombre: "Juan Pérez", email: "juan@carnave.com", rol: "encargado", password: "segura123", telefono: "+5493496111111", galponIds: [2] };

  it("el encargado no puede ver ni gestionar usuarios (403)", async () => {
    const token = await tokenDe("encargado@carnave.com");
    expect((await llamar("/usuarios", { token })).status).toBe(403);
    expect((await llamar("/usuarios", { method: "POST", body: nuevo, token })).status).toBe(403);
    expect((await llamar("/usuarios/1", { method: "PATCH", body: { activo: false }, token })).status).toBe(403);
  });

  it("lista sin contraseñas, con galpones asignados", async () => {
    const { data } = await llamar<UsuarioAdmin[]>("/usuarios", { token: await tokenDe("admin@carnave.com") });
    expect(JSON.stringify(data)).not.toContain(PASSWORD_DEMO);
    expect(data.find((u) => u.id === 2)).toMatchObject({ rol: "encargado", telefono: "+5493496000000", galpones: [{ id: 1 }, { id: 2 }] });
    expect(data.find((u) => u.id === 1)?.galpones).toEqual([]);
  });

  it("alta: el nuevo encargado entra y ve solo sus galpones", async () => {
    const token = await tokenDe("admin@carnave.com");
    const r = await llamar<UsuarioAdmin>("/usuarios", { method: "POST", body: nuevo, token });
    expect(r.status).toBe(201);
    expect(r.data).toMatchObject({ email: "juan@carnave.com", activo: true, galpones: [{ id: 2, nombre: "Galpón 2" }] });
    const login = await llamar<{ token: string }>("/auth/login", { method: "POST", body: { email: "juan@carnave.com", password: "segura123" } });
    expect((await llamar<Galpon[]>("/galpones", { token: login.data.token })).data.map((g) => g.id)).toEqual([2]);
  });

  it("email repetido (sin importar mayúsculas) → 409; datos inválidos → 400", async () => {
    const token = await tokenDe("admin@carnave.com");
    expect((await llamar("/usuarios", { method: "POST", body: { ...nuevo, email: "ENCARGADO@carnave.com" }, token })).status).toBe(409);
    expect((await llamar("/usuarios", { method: "POST", body: { ...nuevo, telefono: "3496111111" }, token })).status).toBe(400);
    expect((await llamar("/usuarios", { method: "POST", body: { ...nuevo, password: "corta" }, token })).status).toBe(400);
    expect((await llamar("/usuarios", { method: "POST", body: { ...nuevo, galponIds: [99] }, token })).status).toBe(400);
  });

  it("edición: cambia datos y reasigna galpones; pasar a admin quita las asignaciones", async () => {
    const token = await tokenDe("admin@carnave.com");
    const r = await llamar<UsuarioAdmin>("/usuarios/2", { method: "PATCH", body: { telefono: null, galponIds: [1] }, token });
    expect(r.data).toMatchObject({ telefono: null, galpones: [{ id: 1 }] });
    const admin = await llamar<UsuarioAdmin>("/usuarios/2", { method: "PATCH", body: { rol: "admin" }, token });
    expect(admin.data).toMatchObject({ rol: "admin", galpones: [] });
  });

  it("baja = desactivar: no puede entrar y su sesión deja de valer; se puede reactivar", async () => {
    const admin = await tokenDe("admin@carnave.com");
    const encargado = await tokenDe("encargado@carnave.com");
    expect((await llamar<UsuarioAdmin>("/usuarios/2", { method: "PATCH", body: { activo: false }, token: admin })).data.activo).toBe(false);
    expect((await llamar("/auth/login", { method: "POST", body: { email: "encargado@carnave.com", password: PASSWORD_DEMO } })).status).toBe(401);
    expect((await llamar("/galpones", { token: encargado })).status).toBe(401);
    expect(db().usuarios.some((u) => u.id === 2)).toBe(true); // no se borra
    await llamar("/usuarios/2", { method: "PATCH", body: { activo: true }, token: admin });
    expect((await llamar("/galpones", { token: encargado })).status).toBe(200);
  });

  it("un admin no puede darse de baja a sí mismo ni dejar el sistema sin admin", async () => {
    const token = await tokenDe("admin@carnave.com");
    expect((await llamar("/usuarios/1", { method: "PATCH", body: { activo: false }, token })).status).toBe(409);
    expect((await llamar("/usuarios/1", { method: "PATCH", body: { rol: "encargado" }, token })).status).toBe(409);
    // Con otro admin activo, sí se puede cambiar el rol del primero.
    await llamar("/usuarios/2", { method: "PATCH", body: { rol: "admin" }, token });
    expect((await llamar("/usuarios/1", { method: "PATCH", body: { rol: "encargado" }, token })).status).toBe(200);
  });
});

describe("granjas y galpones (ABM, solo admin — decisión #35)", () => {
  it("el encargado no puede ver ni gestionar granjas ni galpones (403)", async () => {
    const token = await tokenDe("encargado@carnave.com");
    expect((await llamar("/granjas", { token })).status).toBe(403);
    expect((await llamar("/granjas", { method: "POST", body: { nombre: "X", ubicacion: null }, token })).status).toBe(403);
    expect((await llamar("/granjas/1/galpones", { method: "POST", body: { nombre: "X" }, token })).status).toBe(403);
    expect((await llamar("/galpones/2", { method: "PATCH", body: { activo: false }, token })).status).toBe(403);
  });

  it("lista las granjas con sus galpones", async () => {
    const { data } = await llamar<GranjaAdmin[]>("/granjas", { token: await tokenDe("admin@carnave.com") });
    expect(data).toEqual([{
      id: 1, nombre: "Granja Esperanza", ubicacion: "Esperanza, Santa Fe", activo: true,
      galpones: [
        { id: 1, nombre: "Galpón 1", estadoOperativo: "produccion", activo: true },
        { id: 2, nombre: "Galpón 2", estadoOperativo: "limpieza", activo: true },
      ],
    }]);
  });

  it("alta y edición de granja; nombre vacío → 400, repetido sin mayúsculas → 409", async () => {
    const token = await tokenDe("admin@carnave.com");
    const r = await llamar<GranjaAdmin>("/granjas", { method: "POST", body: { nombre: "  Granja Norte ", ubicacion: "" }, token });
    expect(r.status).toBe(201);
    expect(r.data).toEqual({ id: 2, nombre: "Granja Norte", ubicacion: null, activo: true, galpones: [] });
    expect((await llamar("/granjas", { method: "POST", body: { nombre: "   ", ubicacion: null }, token })).status).toBe(400);
    expect((await llamar("/granjas", { method: "POST", body: { nombre: "granja norte", ubicacion: null }, token })).status).toBe(409);
    const e = await llamar<GranjaAdmin>("/granjas/2", { method: "PATCH", body: { ubicacion: "Rafaela" }, token });
    expect(e.data).toMatchObject({ nombre: "Granja Norte", ubicacion: "Rafaela" });
    expect((await llamar("/granjas/2", { method: "PATCH", body: { nombre: "GRANJA ESPERANZA" }, token })).status).toBe(409);
    expect((await llamar("/granjas/99", { token })).status).toBe(404);
  });

  it("alta de galpón: nace disponible, visible en el dashboard y asignable", async () => {
    const token = await tokenDe("admin@carnave.com");
    const r = await llamar<GalponAdmin>("/granjas/1/galpones", { method: "POST", body: { nombre: " Galpón 3 " }, token });
    expect(r.status).toBe(201);
    expect(r.data).toEqual({ id: 3, nombre: "Galpón 3", estadoOperativo: "disponible", activo: true });
    expect((await llamar<Galpon>("/galpones/3", { token })).data).toMatchObject({ estadoOperativo: "disponible", loteActivo: null });
    expect((await llamar("/usuarios/2", { method: "PATCH", body: { galponIds: [1, 2, 3] }, token })).status).toBe(200);
  });

  it("nombre de galpón: vacío → 400; repetido en la misma granja → 409; en otra granja se puede", async () => {
    const token = await tokenDe("admin@carnave.com");
    expect((await llamar("/granjas/1/galpones", { method: "POST", body: { nombre: "" }, token })).status).toBe(400);
    expect((await llamar("/granjas/1/galpones", { method: "POST", body: { nombre: "galpón 1" }, token })).status).toBe(409);
    expect((await llamar("/galpones/2", { method: "PATCH", body: { nombre: "GALPÓN 1" }, token })).status).toBe(409);
    await llamar("/granjas", { method: "POST", body: { nombre: "Granja Norte", ubicacion: null }, token });
    expect((await llamar("/granjas/2/galpones", { method: "POST", body: { nombre: "Galpón 1" }, token })).status).toBe(201);
    expect((await llamar<GalponAdmin>("/galpones/2", { method: "PATCH", body: { nombre: "Galpón Sur" }, token })).data.nombre).toBe("Galpón Sur");
  });

  it("no se da de baja un galpón en producción (409)", async () => {
    const token = await tokenDe("admin@carnave.com");
    expect((await llamar("/galpones/1", { method: "PATCH", body: { activo: false }, token })).status).toBe(409);
    expect(db().galpones.find((g) => g.id === 1)?.activo).toBe(true);
  });

  it("baja de galpón: desaparece del dashboard, se desactiva el nodo, se quitan asignaciones y se resuelven sus alertas", async () => {
    const admin = await tokenDe("admin@carnave.com");
    const encargado = await tokenDe("encargado@carnave.com");
    const abierta = db().alertas.find((a) => a.id === uuidDemo(5))!;
    Object.assign(abierta, { estado: "activa", fechaResolucion: null, resolucionAutomatica: false });

    const r = await llamar<GalponAdmin>("/galpones/2", { method: "PATCH", body: { activo: false }, token: admin });
    expect(r.data).toMatchObject({ id: 2, activo: false, estadoOperativo: "limpieza" });

    expect((await llamar<Galpon[]>("/galpones", { token: admin })).data.map((g) => g.id)).toEqual([1]);
    expect((await llamar("/galpones/2", { token: admin })).status).toBe(404);
    expect((await llamar<Galpon[]>("/galpones", { token: encargado })).data.map((g) => g.id)).toEqual([1]);
    expect(db().nodos.find((n) => n.galponId === 2)?.activo).toBe(false);
    expect(db().usuarioGalpon.some((ug) => ug.galponId === 2)).toBe(false);
    expect(abierta).toMatchObject({ estado: "resuelta", resueltaPor: null, resolucionAutomatica: true, fechaResolucion: "2026-09-28T15:00:00.000Z" });
    // El admin sigue viendo sus alertas (resueltas) en el historial.
    const alertas = await llamar<Alerta[]>("/alertas?galponId=2", { token: admin });
    expect(alertas.data.every((a) => a.estado === "resuelta")).toBe(true);
    expect(alertas.data.length).toBeGreaterThan(0);
    // No se puede asignar ni cargarle lotes; sigue en el listado de la granja, como inactivo.
    expect((await llamar("/usuarios/2", { method: "PATCH", body: { galponIds: [2] }, token: admin })).status).toBe(400);
    const granja = await llamar<GranjaAdmin>("/granjas/1", { token: admin });
    expect(granja.data.galpones.map((g) => [g.id, g.activo])).toEqual([[1, true], [2, false]]);
  });

  it("el nombre de un galpón dado de baja queda libre; reactivarlo con el nombre ocupado → 409", async () => {
    const token = await tokenDe("admin@carnave.com");
    await llamar("/galpones/2", { method: "PATCH", body: { activo: false }, token });
    expect((await llamar("/granjas/1/galpones", { method: "POST", body: { nombre: "Galpón 2" }, token })).status).toBe(201);
    expect((await llamar("/galpones/2", { method: "PATCH", body: { activo: true }, token })).status).toBe(409);
    const r = await llamar<GalponAdmin>("/galpones/2", { method: "PATCH", body: { nombre: "Galpón 2 (viejo)", activo: true }, token });
    expect(r.data).toMatchObject({ nombre: "Galpón 2 (viejo)", activo: true });
  });

  it("baja de granja solo sin galpones activos; con la granja inactiva no hay altas ni reactivaciones", async () => {
    const token = await tokenDe("admin@carnave.com");
    await llamar("/granjas", { method: "POST", body: { nombre: "Granja Norte", ubicacion: null }, token });
    await llamar("/granjas/2/galpones", { method: "POST", body: { nombre: "Galpón A" }, token });
    expect((await llamar("/granjas/2", { method: "PATCH", body: { activo: false }, token })).status).toBe(409);
    await llamar("/galpones/3", { method: "PATCH", body: { activo: false }, token });
    expect((await llamar<GranjaAdmin>("/granjas/2", { method: "PATCH", body: { activo: false }, token })).data.activo).toBe(false);
    expect((await llamar("/granjas/2/galpones", { method: "POST", body: { nombre: "Galpón B" }, token })).status).toBe(409);
    expect((await llamar("/galpones/3", { method: "PATCH", body: { activo: true }, token })).status).toBe(409);
    // Activas primero en el listado.
    expect((await llamar<GranjaAdmin[]>("/granjas", { token })).data.map((g) => g.id)).toEqual([1, 2]);
    await llamar("/granjas/2", { method: "PATCH", body: { activo: true }, token });
    expect((await llamar("/galpones/3", { method: "PATCH", body: { activo: true }, token })).status).toBe(200);
  });
});
