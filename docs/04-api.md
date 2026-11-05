# API — Carnave

Contrato que consume el frontend (`app_carnave`). Está implementado de punta a punta en la API simulada (`src/mocks/api.ts`) y sus reglas están cubiertas por `src/mocks/api.test.ts`. **El backend real tiene que responder exactamente estas rutas y formas.** Si algo cambia, se actualiza acá, en los tipos de `src/features/*/types.ts` y en el mock.

## Convenciones

- REST sobre HTTPS, JSON en **camelCase** — también los query params (`?galponId=`). Rutas bajo `/api/v1`.
- Auth: `Authorization: Bearer <token>` (el token lo emite `POST /auth/login`; el frontend lo guarda en una cookie httpOnly propia y lo reenvía, nunca lo expone al navegador).
- Fechas: `yyyy-mm-dd` para días (`fechaInicio`), ISO 8601 con zona para instantes (`fechaDisparo`, `ts`). **Nunca tiempos relativos** ("hace 5 min"): los calcula el frontend. Los días son días de **Argentina** (`America/Argentina/Buenos_Aires`), igual que `hoy_ar()` en la base.
- IDs numéricos (BIGSERIAL), salvo las alertas: **UUID** (las genera el Pi, ver `06-sincronizacion.md`).
- Errores: status HTTP + `{ "error": "mensaje para mostrar al usuario" }`.
  - `400` datos inválidos · `401` sin sesión o token vencido (el frontend redirige al login) · `404` no existe **o el usuario no tiene acceso** (no se distingue, para no filtrar existencia) · `409` transición de estado no permitida.
  - Los triggers de la base ya devuelven `SQLSTATE CN400` / `CN409` con el mensaje para el usuario: la API los traduce a `400` / `409` sin reescribir la regla.
- Auditoría: en cada transacción la API hace `SET LOCAL carnave.usuario_id = '<id>'` (ver `03-modelo-datos.md`).
- Permisos: el `admin` ve todos los galpones; el `encargado` solo los de `usuario_galpon`. Cada endpoint filtra por esto.
- La lógica de negocio (umbrales, severidad, estado del nodo, edad del lote) la resuelve **el backend**; el frontend solo la muestra.

## Auth

| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| POST | `/auth/login` | `{ email, password }` | `200 { token, usuario: { id, nombre, email, rol } }` · `401` |

## Galpones

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/galpones` | Galpones visibles para el usuario (todas sus granjas). Alimenta el dashboard. |
| GET | `/galpones/:id` | Un galpón (misma forma). |
| PATCH | `/galpones/:id/estado` | Body `{ estadoOperativo: "disponible" }`. Única transición manual: `limpieza → disponible` (para dejar el galpón libre sin cargar lote todavía). Otra → `409`. |

`GET /galpones` y `GET /galpones/:id` no incluyen galpones inactivos (baja desde Granjas, decisión #35): un galpón inactivo devuelve `404`.

Forma de `Galpon`:

```jsonc
{
  "id": 1,
  "nombre": "Galpón 1",
  "granja": { "id": 1, "nombre": "Granja Esperanza" },
  "estadoOperativo": "produccion",            // produccion | limpieza | disponible
  "nodo": {
    "ultimaConexion": "2026-09-28T14:59:00Z", // null si nunca reportó
    "estado": "online"                        // online (<5 min) | retrasado (<15 min) | caido
  },
  "loteActivo": {                             // null si no hay
    "id": 13, "numero": "13",                 // numero: opcional, lo carga el usuario
    "fechaInicio": "2026-09-10", "fechaFinEstimada": "2026-10-25",
    "cantidadAvesInicial": 12400,
    "edadDias": 18                            // edad_dias() del backend
  },
  "limpieza": null,                           // solo en limpieza: { "fechaInicio": "2026-09-26", "fechaFinEstimada": "2026-10-11" }
  "lecturas": [                               // última lectura por métrica
    { "metrica": "co2", "valor": 2850, "ts": "…", "severidad": "warning" }
    // severidad: ok | warning | critica, o null si el galpón no está en producción
  ],
  "alertasSinAtender": 2,                     // alertas activas o escaladas, de cualquier tipo
  "umbrales": {                               // regla_alerta vigente para la edad del lote; {} fuera de producción
    "temperatura": { "minWarning": 24, "maxWarning": 28, "minCritico": 22, "maxCritico": 31 }
  }
}
```

`nodo.estado` usa los umbrales de `configuracion_sistema` (`nodo_retrasado_seg`, `nodo_caido_seg`). Alcanzar un umbral ya cuenta (`valor >= maxWarning` es warning). Toda edad tiene regla (el último rango de cada métrica no tiene tope).

## Lecturas

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/galpones/:id/lecturas?desde=&hasta=&metrica=` | Serie histórica. `desde`/`hasta` ISO; `metrica` opcional (sin ella, las 4). `desde >= hasta` → `400`. |
| WS | `/ws/galpones/:id` | Stream en tiempo real (pendiente). |

Respuesta: `[{ "metrica": "temperatura", "puntos": [{ "ts": "…", "valor": 27.4 }] }]`. El backend elige la resolución según el rango (crudo para 24 h, `lectura_1h` para 7 días o lote completo).

## Lotes

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/galpones/:id/lotes` | Todos los lotes del galpón, más reciente primero. |
| POST | `/galpones/:id/lotes` | Alta. Body `{ numero (string \| null, máx. 20), fechaInicio, fechaFinEstimada, cantidadAvesInicial }` → `201 Lote`. `fechaInicio` no puede ser futura (hoy en Argentina) → `400`. Se puede con el galpón `disponible` o en `limpieza` (la limpieza se da por terminada); en `produccion` → `409`. Pasa el galpón a `produccion`. Admin y encargado por igual. |
| PATCH | `/lotes/:id/finalizar` | Cierra el lote activo (`fechaFinReal` = hoy, registra quién) y pasa el galpón a `limpieza` con sus fechas de limpieza. Lote no activo → `409`. |

`Lote`: `{ id, galponId, numero, fechaInicio, fechaFinEstimada, fechaFinReal, estado, cantidadAvesInicial }`. `estado`: `activo` | `finalizado` (no existen `planificado` ni `cancelado`).

## Alertas

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/alertas?estado=abierta\|resuelta&galponId=` | `abierta` = activa, reconocida o escalada. Sin `estado`, todas. Incluye los tres tipos. |
| PATCH | `/alertas/:id/reconocer` | `:id` es UUID. Solo desde `activa` o `escalada` (si no, `409`). Registra `fechaReconocimiento` y `reconocidaPor`. |
| PATCH | `/alertas/:id/resolver` | Desde cualquier estado no resuelto. Admin y encargado por igual. |
| GET | `/alertas/:id/historial` | Eventos `[{ evento, ts, usuario: { id, nombre } \| null }]`, `evento`: `disparada` \| `critica` \| `escalada` \| `reconocida` \| `resuelta` (pendiente en el frontend). |

`Alerta`:

```jsonc
{
  "id": "00000000-0000-4000-8000-000000000002",  // UUID
  "tipo": "ambiental",                         // ambiental | nodo_caido | dato_retrasado
  "galpon": { "id": 1, "nombre": "Galpón 1" },
  "metrica": "co2",                            // null en nodo_caido
  "severidad": "warning",                      // warning | critica (nunca baja)
  "valorLeido": 2850,                          // solo en ambiental; null en los otros tipos
  "estado": "activa",                          // activa | reconocida | escalada | resuelta
  "fechaDisparo": "…", "fechaReconocimiento": null, "fechaEscalada": null, "fechaResolucion": null,
  "reconocidaPor": null,                       // { id, nombre }
  "resueltaPor": null,                         // { id, nombre }; null si fue automática
  "resolucionAutomatica": false
}
```

## Usuarios (solo admin)

Un encargado recibe `403` en todas estas rutas. La baja es **desactivar** (`activo: false`): nunca se borra, porque lotes, alertas e historial guardan quién hizo qué. Un usuario inactivo no puede loguearse y su token deja de valer (`401`).

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/usuarios` | Todos los usuarios (activos primero). Nunca incluye contraseñas. |
| GET | `/usuarios/:id` | Uno (misma forma). |
| POST | `/usuarios` | Alta. Body `{ nombre, email, rol, password, telefono (string \| null), galponIds }` → `201 UsuarioAdmin`. Email repetido (sin distinguir mayúsculas) → `409`; datos inválidos → `400`. |
| PATCH | `/usuarios/:id` | Cambios parciales: `nombre`, `email`, `rol`, `telefono`, `galponIds`, `password` (solo si se cambia), `activo`. `409` si el admin se da de baja a sí mismo o si el cambio deja el sistema sin ningún admin activo. |

`UsuarioAdmin`: `{ id, nombre, email, rol, telefono, activo, galpones: [{ id, nombre }] }`.

- `telefono`: E.164 (`+5493496123456`), `null` = no recibe SMS.
- `galponIds` / `galpones`: asignaciones de `usuario_galpon`. Un admin no lleva asignaciones (ve todo): si se pasa un usuario a admin, se le quitan. Asignar un galpón inactivo → `400`.
- `password`: mínimo 8 caracteres; el backend guarda solo el hash (argon2id).

## Granjas (solo admin)

Un encargado recibe `403` en todas estas rutas (decisión #35). La baja es **desactivar** (`activo: false`), igual que en Usuarios: nunca se borra, porque lotes, lecturas, alertas y asignaciones guardan la historia.

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/granjas` | Todas las granjas (activas primero), con sus galpones. |
| GET | `/granjas/:id` | Una (misma forma). |
| POST | `/granjas` | Alta. Body `{ nombre, ubicacion (string \| null) }` → `201 GranjaAdmin`. Nombre vacío → `400`; nombre repetido entre granjas activas (sin distinguir mayúsculas) → `409`. |
| PATCH | `/granjas/:id` | Cambios parciales: `nombre`, `ubicacion`, `activo`. `activo: false` con galpones activos → `409`. |
| POST | `/granjas/:id/galpones` | Alta de galpón. Body `{ nombre }` → `201 GalponAdmin`; nace `disponible`, sin nodo. Granja inactiva → `409`; nombre vacío → `400`; nombre repetido entre los galpones activos de la granja (sin distinguir mayúsculas) → `409`. |
| PATCH | `/galpones/:id` | Cambios parciales: `nombre`, `activo`. Baja con el galpón en `produccion` → `409`. Reactivar un galpón de una granja inactiva → `409`. Distinta de `PATCH /galpones/:id/estado`. |

`GranjaAdmin`: `{ id, nombre, ubicacion, activo, galpones: GalponAdmin[] }`.

`GalponAdmin`: `{ id, nombre, estadoOperativo, activo }`.

- El galpón no se mueve de granja ni se le edita el estado desde acá: el estado lo manejan los lotes.
- Al dar de baja un galpón: se desactiva su nodo, se quitan sus asignaciones de `usuario_galpon` y sus alertas abiertas se resuelven automáticamente (`resolucionAutomatica: true`). Deja de aparecer en `GET /galpones`; sus alertas resueltas siguen en `GET /alertas`.

## Reglas de alerta y configuración (admin, sin pantalla en el MVP)

- `GET /reglas-alerta` · `POST /reglas-alerta`
- `POST /reglas-alerta/:id/reemplazar` → `201` con la regla nueva (usa `reemplazar_regla()`: desactiva la vieja y crea la versión nueva). **Las reglas no se editan en el lugar.**
- `PATCH /reglas-alerta/:id` solo admite `{ activo: false }`. Si deja una métrica sin cobertura de edad (`v_cobertura_reglas`) → `409`.
- `GET /configuracion` · `PATCH /configuracion/:clave` — ej. `tiempo_escalada_seg`

## Ingesta del gateway (Pi → nube)

Autenticada con el token del gateway, no con sesión de usuario. Detalle en `06-sincronizacion.md`.

- `POST /ingesta/lecturas` · `POST /ingesta/alertas` · `POST /ingesta/notificaciones` · `GET /ingesta/cambios?desde=`
