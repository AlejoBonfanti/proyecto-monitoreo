/**
 * API simulada: responde las mismas rutas y formas que la API real
 * (`/api/v1/...`, ver docs/04-api.md). `lib/api-client.ts` la usa en lugar de
 * `fetch` cuando no hay `API_URL`. Para pasar al backend real no hay que
 * tocar nada fuera de `lib/api-client.ts`: esta carpeta se puede borrar.
 */
import type { Alerta } from "@/features/alertas/types";
import type { LoginRespuesta, Usuario } from "@/features/auth/types";
import type { Galpon, LecturaActual, SerieLecturas } from "@/features/galpones/types";
import type { CambiosGalpon, CambiosGranja, GranjaAdmin, NuevaGranja } from "@/features/granjas/types";
import type { Lote } from "@/features/lotes/types";
import type { CambiosUsuario, NuevoUsuario, UsuarioAdmin } from "@/features/usuarios/types";
import { METRICAS, type Metrica, type Umbrales } from "@/features/metricas/types";
import { ahora as reloj, hoyISO, sumarDias } from "@/lib/fechas";
import { DIAS_LIMPIEZA_ESTIMADOS, type AlertaRow, type GalponRow, type GranjaRow, type LoteRow, type MockDb, type UsuarioRow } from "./datos";
import { db } from "./db";
import { generarSerie } from "./lecturas";
import { edadDias, estadoNodo, evaluarSeveridad, reglaVigente, umbralesDe } from "./motor";

interface Peticion {
  method: string;
  path: string;
  query: URLSearchParams;
  body: unknown;
  usuario: UsuarioRow | null;
  ahora: Date;
}

type Handler = (p: Peticion, params: string[]) => Response;

const json = (data: unknown, status = 200) => Response.json(data, { status });
const error = (status: number, mensaje: string) => json({ error: mensaje }, status);

// ---------- Tokens de la API simulada ----------

const PREFIJO_TOKEN = "mock-token-";

function usuarioDelToken(authorization: string | null): UsuarioRow | null {
  const token = authorization?.replace(/^Bearer\s+/i, "");
  if (!token?.startsWith(PREFIJO_TOKEN)) return null;
  const id = Number(token.slice(PREFIJO_TOKEN.length));
  return db().usuarios.find((u) => u.id === id && u.activo) ?? null;
}

// ---------- Permisos ----------

/** Galpones activos que el usuario puede ver. Los dados de baja no aparecen (decisión #35). */
function galponesVisibles(d: MockDb, u: UsuarioRow): GalponRow[] {
  return galponesConHistorial(d, u).filter((g) => g.activo);
}

/**
 * Incluye los dados de baja: sus alertas (ya resueltas) siguen en `/alertas` para el admin.
 * Al encargado la baja le quita la asignación, así que deja de verlos.
 */
function galponesConHistorial(d: MockDb, u: UsuarioRow): GalponRow[] {
  if (u.rol === "admin") return d.galpones;
  const ids = new Set(d.usuarioGalpon.filter((ug) => ug.usuarioId === u.id).map((ug) => ug.galponId));
  return d.galpones.filter((g) => ids.has(g.id));
}

function galponVisible(d: MockDb, u: UsuarioRow, id: number): GalponRow | null {
  return galponesVisibles(d, u).find((g) => g.id === id) ?? null;
}

// ---------- Serializadores (fila → DTO) ----------

function loteActivo(d: MockDb, galponId: number): LoteRow | null {
  return d.lotes.find((l) => l.galponId === galponId && l.estado === "activo") ?? null;
}

function aGalpon(d: MockDb, g: GalponRow, ahora: Date): Galpon {
  const granja = d.granjas.find((x) => x.id === g.granjaId)!;
  const lote = loteActivo(d, g.id);
  const enProduccion = g.estadoOperativo === "produccion" && lote !== null;
  const edad = lote ? edadDias(lote, ahora) : null;

  const umbrales: Partial<Record<Metrica, Umbrales>> = {};
  if (enProduccion && edad !== null) {
    for (const m of METRICAS) {
      const regla = reglaVigente(d, m, edad, g.granjaId);
      if (regla) umbrales[m] = umbralesDe(regla);
    }
  }

  const lecturas: LecturaActual[] = d.lecturasActuales
    .filter((l) => l.galponId === g.id)
    .map((l) => {
      const u = umbrales[l.metrica];
      return { metrica: l.metrica, valor: l.valor, ts: l.ts, severidad: enProduccion && u ? evaluarSeveridad(l.valor, u) : null };
    });

  const nodo = d.nodos.find((n) => n.galponId === g.id && n.activo);

  return {
    id: g.id,
    nombre: g.nombre,
    granja: { id: granja.id, nombre: granja.nombre },
    estadoOperativo: g.estadoOperativo,
    nodo: { ultimaConexion: nodo?.ultimaConexion ?? null, estado: estadoNodo(nodo?.ultimaConexion ?? null, ahora) },
    loteActivo: lote
      ? { id: lote.id, numero: lote.numero, fechaInicio: lote.fechaInicio, fechaFinEstimada: lote.fechaFinEstimada, cantidadAvesInicial: lote.cantidadAvesInicial, edadDias: edad! }
      : null,
    limpieza:
      g.estadoOperativo === "limpieza" && g.fechaInicioLimpieza && g.fechaFinLimpiezaEstimada
        ? { fechaInicio: g.fechaInicioLimpieza, fechaFinEstimada: g.fechaFinLimpiezaEstimada }
        : null,
    lecturas,
    alertasSinAtender: d.alertas.filter((a) => a.galponId === g.id && (a.estado === "activa" || a.estado === "escalada")).length,
    umbrales,
  };
}

function aLote(l: LoteRow): Lote {
  return { id: l.id, galponId: l.galponId, numero: l.numero, fechaInicio: l.fechaInicio, fechaFinEstimada: l.fechaFinEstimada, fechaFinReal: l.fechaFinReal, estado: l.estado, cantidadAvesInicial: l.cantidadAvesInicial };
}

function aAlerta(d: MockDb, a: AlertaRow): Alerta {
  const ref = (id: number | null) => {
    const u = id === null ? null : d.usuarios.find((x) => x.id === id);
    return u ? { id: u.id, nombre: u.nombre } : null;
  };
  const galpon = d.galpones.find((g) => g.id === a.galponId)!;
  return {
    id: a.id, tipo: a.tipo, galpon: { id: galpon.id, nombre: galpon.nombre }, metrica: a.metrica, severidad: a.severidad,
    valorLeido: a.valorLeido, estado: a.estado, fechaDisparo: a.fechaDisparo, fechaReconocimiento: a.fechaReconocimiento,
    fechaEscalada: a.fechaEscalada, fechaResolucion: a.fechaResolucion, reconocidaPor: ref(a.reconocidaPor),
    resueltaPor: ref(a.resueltaPor), resolucionAutomatica: a.resolucionAutomatica,
  };
}

// ---------- Endpoints ----------

const login: Handler = ({ body }) => {
  const { email, password } = (body ?? {}) as { email?: string; password?: string };
  const u = db().usuarios.find((x) => x.email === email?.toLowerCase().trim() && x.activo);
  if (!u || u.password !== password) return error(401, "Usuario o contraseña incorrectos.");
  const usuario: Usuario = { id: u.id, nombre: u.nombre, email: u.email, rol: u.rol };
  return json({ token: `${PREFIJO_TOKEN}${u.id}`, usuario } satisfies LoginRespuesta);
};

const listarGalpones: Handler = ({ usuario, ahora }) => {
  const d = db();
  return json(galponesVisibles(d, usuario!).map((g) => aGalpon(d, g, ahora)));
};

const obtenerGalpon: Handler = ({ usuario, ahora }, [id]) => {
  const d = db();
  const g = galponVisible(d, usuario!, Number(id));
  return g ? json(aGalpon(d, g, ahora)) : error(404, "Galpón no encontrado.");
};

const cambiarEstadoGalpon: Handler = ({ usuario, body }, [id]) => {
  const d = db();
  const g = galponVisible(d, usuario!, Number(id));
  if (!g) return error(404, "Galpón no encontrado.");
  const { estadoOperativo } = (body ?? {}) as { estadoOperativo?: string };
  // Única transición manual permitida (las otras son automáticas por lote).
  if (estadoOperativo !== "disponible" || g.estadoOperativo !== "limpieza")
    return error(409, "Solo se puede pasar de limpieza a disponible.");
  g.estadoOperativo = "disponible";
  g.fechaInicioLimpieza = null;
  g.fechaFinLimpiezaEstimada = null;
  return json({ ok: true });
};

const listarLecturas: Handler = ({ usuario, query, ahora }, [id]) => {
  const d = db();
  const g = galponVisible(d, usuario!, Number(id));
  if (!g) return error(404, "Galpón no encontrado.");
  const desde = new Date(query.get("desde") ?? ahora.getTime() - 86_400_000);
  const hasta = new Date(query.get("hasta") ?? ahora);
  if (Number.isNaN(desde.getTime()) || Number.isNaN(hasta.getTime()) || desde >= hasta)
    return error(400, "Rango de fechas inválido.");
  const metrica = query.get("metrica");
  const series: SerieLecturas[] = d.lecturasActuales
    .filter((l) => l.galponId === g.id && (!metrica || l.metrica === metrica))
    .map((l) => ({ metrica: l.metrica, puntos: generarSerie(l.metrica, l.valor, desde, hasta) }));
  return json(series);
};

const listarLotes: Handler = ({ usuario }, [id]) => {
  const d = db();
  const g = galponVisible(d, usuario!, Number(id));
  if (!g) return error(404, "Galpón no encontrado.");
  const lotes = d.lotes.filter((l) => l.galponId === g.id).sort((a, b) => b.fechaInicio.localeCompare(a.fechaInicio));
  return json(lotes.map(aLote));
};

const crearLote: Handler = ({ usuario, body, ahora }, [id]) => {
  const d = db();
  const g = galponVisible(d, usuario!, Number(id));
  if (!g) return error(404, "Galpón no encontrado.");
  // En limpieza también se puede: cargar el lote da la limpieza por terminada (decisión #33).
  if (g.estadoOperativo === "produccion") return error(409, "El galpón ya tiene un lote en producción.");
  const b = (body ?? {}) as Partial<Lote>;
  if (!b.fechaInicio || !b.fechaFinEstimada || !b.cantidadAvesInicial || b.cantidadAvesInicial <= 0)
    return error(400, "Datos del lote incompletos.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.fechaInicio) || !/^\d{4}-\d{2}-\d{2}$/.test(b.fechaFinEstimada))
    return error(400, "Fechas inválidas.");
  if (b.fechaInicio > hoyISO(ahora)) return error(400, "La fecha de inicio no puede ser futura.");
  if (b.fechaFinEstimada <= b.fechaInicio)
    return error(400, "La fecha de fin estimada debe ser posterior al inicio.");
  const numero = b.numero?.trim() || null;
  if (numero && numero.length > 20) return error(400, "El número de lote admite hasta 20 caracteres.");
  const lote: LoteRow = {
    id: d.secuencias.lote++, galponId: g.id, numero, fechaInicio: b.fechaInicio,
    fechaFinEstimada: b.fechaFinEstimada, fechaFinReal: null, estado: "activo",
    cantidadAvesInicial: b.cantidadAvesInicial, createdBy: usuario!.id, finalizadoPor: null,
  };
  d.lotes.push(lote);
  g.estadoOperativo = "produccion"; // transición automática (desde disponible o limpieza)
  g.fechaInicioLimpieza = null;
  g.fechaFinLimpiezaEstimada = null;
  return json(aLote(lote), 201);
};

const finalizarLote: Handler = ({ usuario, ahora }, [id]) => {
  const d = db();
  const lote = d.lotes.find((l) => l.id === Number(id));
  const g = lote ? galponVisible(d, usuario!, lote.galponId) : null;
  if (!lote || !g) return error(404, "Lote no encontrado.");
  if (lote.estado !== "activo") return error(409, "El lote no está activo.");
  lote.estado = "finalizado";
  lote.fechaFinReal = hoyISO(ahora);
  lote.finalizadoPor = usuario!.id;
  g.estadoOperativo = "limpieza"; // transición automática, con las fechas de limpieza
  g.fechaInicioLimpieza = lote.fechaFinReal;
  g.fechaFinLimpiezaEstimada = sumarDias(lote.fechaFinReal, DIAS_LIMPIEZA_ESTIMADOS);
  return json(aLote(lote));
};

const listarAlertas: Handler = ({ usuario, query }) => {
  const d = db();
  const visibles = new Set(galponesConHistorial(d, usuario!).map((g) => g.id));
  const estado = query.get("estado"); // "abierta" | "resuelta"
  const galponId = query.get("galponId");
  const alertas = d.alertas
    .filter((a) => visibles.has(a.galponId))
    .filter((a) => !galponId || a.galponId === Number(galponId))
    .filter((a) => (estado === "resuelta" ? a.estado === "resuelta" : estado === "abierta" ? a.estado !== "resuelta" : true))
    .sort((a, b) => b.fechaDisparo.localeCompare(a.fechaDisparo));
  return json(alertas.map((a) => aAlerta(d, a)));
};

function transicionAlerta(accion: "reconocer" | "resolver"): Handler {
  return ({ usuario, ahora }, [id]) => {
    const d = db();
    const a = d.alertas.find((x) => x.id === id.toLowerCase());
    if (!a || !galponVisible(d, usuario!, a.galponId)) return error(404, "Alerta no encontrada.");
    if (accion === "reconocer") {
      if (a.estado !== "activa" && a.estado !== "escalada") return error(409, "La alerta no se puede reconocer en su estado actual.");
      a.estado = "reconocida";
      a.fechaReconocimiento = ahora.toISOString();
      a.reconocidaPor = usuario!.id;
    } else {
      if (a.estado === "resuelta") return error(409, "La alerta ya está resuelta.");
      a.estado = "resuelta";
      a.fechaResolucion = ahora.toISOString();
      a.resueltaPor = usuario!.id;
    }
    return json(aAlerta(d, a));
  };
}

// ---------- Usuarios (solo admin) ----------

const TELEFONO_E164 = /^\+[1-9]\d{7,14}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function soloAdmin(u: UsuarioRow | null, que: "usuarios" | "granjas" = "usuarios"): Response | null {
  return u?.rol === "admin" ? null : error(403, `Solo un administrador puede gestionar ${que}.`);
}

function aUsuarioAdmin(d: MockDb, u: UsuarioRow): UsuarioAdmin {
  const ids = new Set(d.usuarioGalpon.filter((ug) => ug.usuarioId === u.id).map((ug) => ug.galponId));
  return {
    id: u.id, nombre: u.nombre, email: u.email, rol: u.rol, telefono: u.telefono, activo: u.activo,
    galpones: d.galpones.filter((g) => ids.has(g.id)).map((g) => ({ id: g.id, nombre: g.nombre })),
  };
}

/** Valida los campos presentes; devuelve el mensaje de error o null. Mismas reglas que la base. */
function validarUsuario(d: MockDb, b: CambiosUsuario, idActual: number | null): string | null {
  if (b.nombre !== undefined && !b.nombre.trim()) return "El nombre es obligatorio.";
  if (b.email !== undefined) {
    if (!EMAIL.test(b.email)) return "Email inválido.";
    // En la base el email es CITEXT: no distingue mayúsculas.
    const repetido = d.usuarios.some((u) => u.id !== idActual && u.email.toLowerCase() === b.email!.toLowerCase());
    if (repetido) return "Ya existe un usuario con ese email.";
  }
  if (b.rol !== undefined && b.rol !== "admin" && b.rol !== "encargado") return "Rol inválido.";
  if (b.password !== undefined && b.password.length < 8) return "La contraseña necesita al menos 8 caracteres.";
  if (b.telefono !== undefined && b.telefono !== null && !TELEFONO_E164.test(b.telefono)) return "Teléfono inválido (formato +549…).";
  if (b.galponIds !== undefined && b.galponIds.some((id) => !d.galpones.some((g) => g.id === id && g.activo)))
    return "Galpón inexistente o dado de baja.";
  return null;
}

function asignarGalpones(d: MockDb, usuarioId: number, rol: UsuarioRow["rol"], galponIds: number[]) {
  d.usuarioGalpon = d.usuarioGalpon.filter((ug) => ug.usuarioId !== usuarioId);
  // El admin ve todo: no lleva filas en usuario_galpon.
  if (rol === "encargado") for (const galponId of new Set(galponIds)) d.usuarioGalpon.push({ usuarioId, galponId });
}

const listarUsuarios: Handler = ({ usuario }) => {
  const prohibido = soloAdmin(usuario);
  if (prohibido) return prohibido;
  const d = db();
  const orden = [...d.usuarios].sort((a, b) => Number(b.activo) - Number(a.activo) || a.nombre.localeCompare(b.nombre));
  return json(orden.map((u) => aUsuarioAdmin(d, u)));
};

const obtenerUsuario: Handler = ({ usuario }, [id]) => {
  const prohibido = soloAdmin(usuario);
  if (prohibido) return prohibido;
  const d = db();
  const u = d.usuarios.find((x) => x.id === Number(id));
  return u ? json(aUsuarioAdmin(d, u)) : error(404, "Usuario no encontrado.");
};

const crearUsuario: Handler = ({ usuario, body }) => {
  const prohibido = soloAdmin(usuario);
  if (prohibido) return prohibido;
  const d = db();
  const b = (body ?? {}) as Partial<NuevoUsuario>;
  if (!b.nombre || !b.email || !b.rol || !b.password) return error(400, "Faltan datos del usuario.");
  const email = b.email.trim().toLowerCase();
  const invalido = validarUsuario(d, { ...b, email }, null);
  if (invalido) return error(invalido.startsWith("Ya existe") ? 409 : 400, invalido);
  const nuevo: UsuarioRow = {
    id: d.secuencias.usuario++, nombre: b.nombre.trim(), email, password: b.password, rol: b.rol,
    telefono: b.telefono ?? null, activo: true,
  };
  d.usuarios.push(nuevo);
  asignarGalpones(d, nuevo.id, nuevo.rol, b.galponIds ?? []);
  return json(aUsuarioAdmin(d, nuevo), 201);
};

const actualizarUsuario: Handler = ({ usuario, body }, [id]) => {
  const prohibido = soloAdmin(usuario);
  if (prohibido) return prohibido;
  const d = db();
  const u = d.usuarios.find((x) => x.id === Number(id));
  if (!u) return error(404, "Usuario no encontrado.");
  const b = { ...((body ?? {}) as CambiosUsuario) };
  if (b.email !== undefined) b.email = b.email.trim().toLowerCase();
  const invalido = validarUsuario(d, b, u.id);
  if (invalido) return error(invalido.startsWith("Ya existe") ? 409 : 400, invalido);

  const rol = b.rol ?? u.rol;
  const activo = b.activo ?? u.activo;
  if (u.id === usuario!.id && !activo) return error(409, "No podés darte de baja a vos mismo.");
  // Siempre tiene que quedar al menos un admin activo.
  const quedaSinAdmin = u.rol === "admin" && u.activo && (rol !== "admin" || !activo) &&
    !d.usuarios.some((x) => x.id !== u.id && x.rol === "admin" && x.activo);
  if (quedaSinAdmin) return error(409, "Tiene que quedar al menos un administrador activo.");

  if (b.nombre !== undefined) u.nombre = b.nombre.trim();
  if (b.email !== undefined) u.email = b.email;
  if (b.password !== undefined) u.password = b.password;
  if (b.telefono !== undefined) u.telefono = b.telefono;
  u.rol = rol;
  u.activo = activo;
  if (b.galponIds !== undefined || b.rol !== undefined) {
    const actuales = d.usuarioGalpon.filter((ug) => ug.usuarioId === u.id).map((ug) => ug.galponId);
    asignarGalpones(d, u.id, rol, b.galponIds ?? actuales);
  }
  return json(aUsuarioAdmin(d, u));
};

// ---------- Granjas y galpones (ABM, solo admin — decisión #35) ----------
// Baja = desactivar, nunca borrar. Mismas reglas que los triggers de docs/sql/001_esquema.sql.

const porNombre = (a: { nombre: string }, b: { nombre: string }) => a.nombre.localeCompare(b.nombre, "es", { numeric: true });
const mismoNombre = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

function aGranjaAdmin(d: MockDb, gr: GranjaRow): GranjaAdmin {
  const galpones = d.galpones
    .filter((g) => g.granjaId === gr.id)
    .sort((a, b) => Number(b.activo) - Number(a.activo) || porNombre(a, b))
    .map((g) => ({ id: g.id, nombre: g.nombre, estadoOperativo: g.estadoOperativo, activo: g.activo }));
  return { id: gr.id, nombre: gr.nombre, ubicacion: gr.ubicacion, activo: gr.activo, galpones };
}

/** Nombre vacío → 400; repetido entre las granjas activas (sin mayúsculas) → 409. */
function validarNombreGranja(d: MockDb, nombre: string, idActual: number | null): Response | null {
  if (!nombre.trim()) return error(400, "El nombre de la granja es obligatorio.");
  if (d.granjas.some((g) => g.id !== idActual && g.activo && mismoNombre(g.nombre, nombre)))
    return error(409, "Ya existe una granja activa con ese nombre.");
  return null;
}

/** Nombre vacío → 400; repetido entre los galpones activos de la granja (sin mayúsculas) → 409. */
function validarNombreGalpon(d: MockDb, granjaId: number, nombre: string, idActual: number | null): Response | null {
  if (!nombre.trim()) return error(400, "El nombre del galpón es obligatorio.");
  if (d.galpones.some((g) => g.id !== idActual && g.granjaId === granjaId && g.activo && mismoNombre(g.nombre, nombre)))
    return error(409, "Ya existe un galpón activo con ese nombre en esta granja.");
  return null;
}

const listarGranjas: Handler = ({ usuario }) => {
  const prohibido = soloAdmin(usuario, "granjas");
  if (prohibido) return prohibido;
  const d = db();
  const orden = [...d.granjas].sort((a, b) => Number(b.activo) - Number(a.activo) || porNombre(a, b));
  return json(orden.map((g) => aGranjaAdmin(d, g)));
};

const obtenerGranja: Handler = ({ usuario }, [id]) => {
  const prohibido = soloAdmin(usuario, "granjas");
  if (prohibido) return prohibido;
  const d = db();
  const g = d.granjas.find((x) => x.id === Number(id));
  return g ? json(aGranjaAdmin(d, g)) : error(404, "Granja no encontrada.");
};

const crearGranja: Handler = ({ usuario, body }) => {
  const prohibido = soloAdmin(usuario, "granjas");
  if (prohibido) return prohibido;
  const d = db();
  const b = (body ?? {}) as Partial<NuevaGranja>;
  const invalido = validarNombreGranja(d, b.nombre ?? "", null);
  if (invalido) return invalido;
  const nueva: GranjaRow = { id: d.secuencias.granja++, nombre: b.nombre!.trim(), ubicacion: b.ubicacion?.trim() || null, activo: true };
  d.granjas.push(nueva);
  return json(aGranjaAdmin(d, nueva), 201);
};

const actualizarGranja: Handler = ({ usuario, body }, [id]) => {
  const prohibido = soloAdmin(usuario, "granjas");
  if (prohibido) return prohibido;
  const d = db();
  const g = d.granjas.find((x) => x.id === Number(id));
  if (!g) return error(404, "Granja no encontrada.");
  const b = (body ?? {}) as CambiosGranja;
  const activo = b.activo ?? g.activo;
  // Se valida el nombre final contra las activas (también al reactivar).
  if (b.nombre !== undefined || (activo && !g.activo)) {
    const invalido = validarNombreGranja(d, b.nombre ?? g.nombre, g.id);
    if (invalido) return invalido;
  }
  if (g.activo && !activo && d.galpones.some((x) => x.granjaId === g.id && x.activo))
    return error(409, "La granja tiene galpones activos: dalos de baja primero.");
  if (b.nombre !== undefined) g.nombre = b.nombre.trim();
  if (b.ubicacion !== undefined) g.ubicacion = b.ubicacion?.trim() || null;
  g.activo = activo;
  return json(aGranjaAdmin(d, g));
};

const crearGalponEnGranja: Handler = ({ usuario, body }, [id]) => {
  const prohibido = soloAdmin(usuario, "granjas");
  if (prohibido) return prohibido;
  const d = db();
  const granja = d.granjas.find((x) => x.id === Number(id));
  if (!granja) return error(404, "Granja no encontrada.");
  if (!granja.activo) return error(409, "La granja está dada de baja.");
  const { nombre = "" } = (body ?? {}) as { nombre?: string };
  const invalido = validarNombreGalpon(d, granja.id, nombre, null);
  if (invalido) return invalido;
  const nuevo: GalponRow = {
    id: d.secuencias.galpon++, granjaId: granja.id, nombre: nombre.trim(), estadoOperativo: "disponible",
    fechaInicioLimpieza: null, fechaFinLimpiezaEstimada: null, activo: true,
  };
  d.galpones.push(nuevo);
  return json({ id: nuevo.id, nombre: nuevo.nombre, estadoOperativo: nuevo.estadoOperativo, activo: nuevo.activo }, 201);
};

/** Efectos de la baja (en la base los hace el trigger `galpon_despues_baja`). */
function darDeBajaGalpon(d: MockDb, g: GalponRow, ahora: Date) {
  g.activo = false;
  for (const n of d.nodos) if (n.galponId === g.id) n.activo = false;
  d.usuarioGalpon = d.usuarioGalpon.filter((ug) => ug.galponId !== g.id);
  for (const a of d.alertas) {
    if (a.galponId !== g.id || a.estado === "resuelta") continue;
    a.estado = "resuelta";
    a.fechaResolucion = ahora.toISOString();
    a.resueltaPor = null;
    a.resolucionAutomatica = true;
  }
}

const actualizarGalpon: Handler = ({ usuario, body, ahora }, [id]) => {
  const prohibido = soloAdmin(usuario, "granjas");
  if (prohibido) return prohibido;
  const d = db();
  const g = d.galpones.find((x) => x.id === Number(id));
  if (!g) return error(404, "Galpón no encontrado.");
  const b = (body ?? {}) as CambiosGalpon;
  const activo = b.activo ?? g.activo;
  if (g.activo && !activo && g.estadoOperativo === "produccion")
    return error(409, "No se puede dar de baja un galpón en producción: primero finalizá el lote.");
  if (!g.activo && activo && !d.granjas.find((x) => x.id === g.granjaId)?.activo)
    return error(409, "La granja está dada de baja: reactivala primero.");
  if (b.nombre !== undefined || (activo && !g.activo)) {
    const invalido = validarNombreGalpon(d, g.granjaId, b.nombre ?? g.nombre, g.id);
    if (invalido) return invalido;
  }
  if (b.nombre !== undefined) g.nombre = b.nombre.trim();
  if (g.activo && !activo) darDeBajaGalpon(d, g, ahora);
  else g.activo = activo;
  return json({ id: g.id, nombre: g.nombre, estadoOperativo: g.estadoOperativo, activo: g.activo });
};

// ---------- Router ----------

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

const RUTAS: [method: string, patron: RegExp, handler: Handler, publica?: boolean][] = [
  ["POST", /^\/auth\/login$/, login, true],
  ["GET", /^\/galpones$/, listarGalpones],
  ["GET", /^\/galpones\/(\d+)$/, obtenerGalpon],
  ["PATCH", /^\/galpones\/(\d+)\/estado$/, cambiarEstadoGalpon],
  ["GET", /^\/galpones\/(\d+)\/lecturas$/, listarLecturas],
  ["GET", /^\/galpones\/(\d+)\/lotes$/, listarLotes],
  ["POST", /^\/galpones\/(\d+)\/lotes$/, crearLote],
  ["PATCH", /^\/lotes\/(\d+)\/finalizar$/, finalizarLote],
  ["GET", /^\/usuarios$/, listarUsuarios],
  ["POST", /^\/usuarios$/, crearUsuario],
  ["GET", /^\/usuarios\/(\d+)$/, obtenerUsuario],
  ["PATCH", /^\/usuarios\/(\d+)$/, actualizarUsuario],
  ["GET", /^\/granjas$/, listarGranjas],
  ["POST", /^\/granjas$/, crearGranja],
  ["GET", /^\/granjas\/(\d+)$/, obtenerGranja],
  ["PATCH", /^\/granjas\/(\d+)$/, actualizarGranja],
  ["POST", /^\/granjas\/(\d+)\/galpones$/, crearGalponEnGranja],
  ["PATCH", /^\/galpones\/(\d+)$/, actualizarGalpon],
  ["GET", /^\/alertas$/, listarAlertas],
  ["PATCH", new RegExp(`^/alertas/(${UUID})/reconocer$`, "i"), transicionAlerta("reconocer")],
  ["PATCH", new RegExp(`^/alertas/(${UUID})/resolver$`, "i"), transicionAlerta("resolver")],
];

/** Equivalente a `fetch(API_URL + "/api/v1" + ruta, init)` contra la API simulada. */
export async function mockFetch(ruta: string, init: RequestInit = {}): Promise<Response> {
  const url = new URL(ruta, "http://mock");
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);

  for (const [m, patron, handler, publica] of RUTAS) {
    const match = m === method ? patron.exec(url.pathname) : null;
    if (!match) continue;
    const usuario = usuarioDelToken(headers.get("authorization"));
    if (!publica && !usuario) return error(401, "No autenticado.");
    const body = typeof init.body === "string" ? JSON.parse(init.body) : undefined;
    return handler(
      { method, path: url.pathname, query: url.searchParams, body, usuario, ahora: reloj() },
      match.slice(1),
    );
  }
  return error(404, `Ruta simulada inexistente: ${method} ${url.pathname}`);
}
