# Modelo de datos — Carnave

> **El esquema ejecutable está en [`sql/001_esquema.sql`](sql/001_esquema.sql)** (PostgreSQL 16 + TimescaleDB) y es la fuente única: se corre tal cual y está probado con [`sql/pruebas.sql`](sql/pruebas.sql). Este documento explica **qué** hay y **por qué**; si alguna vez difiere del `.sql`, manda el `.sql`.
>
> Datos iniciales del piloto (admin, granja, galpón, reglas provisionales): [`sql/002_datos_iniciales.sql`](sql/002_datos_iniciales.sql).

## Mapa

```
granja ──< gateway (1 Pi activo por granja)
   │
   └──< galpon ──< nodo (1 ESP32 activo por galpón)
          │
          ├──< lote (máx. 1 activo) ──┐
          │                           │ snapshot
          ├──< lectura (hypertable) ──┘
          ├──< alerta ──< alerta_historial      alerta >── regla_alerta (inmutable, versionada)
          │       └──< notificacion >── usuario
          └──< galpon_estado_historial

usuario ──< usuario_galpon >── galpon         usuario ──< usuario_dispositivo_push
configuracion_sistema (clave → valor)
```

**Regla de oro:** una `alerta` queda vinculada al `lote` activo y a la `regla_alerta` exacta que la disparó. Como las reglas no se editan (se reemplazan), meses después se puede auditar "¿por qué se disparó?" con los umbrales reales de ese momento.

## Convenciones del esquema

| Tema | Regla |
|---|---|
| Zona horaria | La base usa `America/Argentina/Buenos_Aires`. Todo "día" de negocio (hoy, edad del lote, fin de lote) sale de `hoy_ar()`, que no depende de la zona de la sesión. El Pi y el frontend usan la misma zona. |
| Errores de negocio | Los triggers lanzan `SQLSTATE CN400` (dato inválido → HTTP 400) o `CN409` (transición no permitida → HTTP 409). La API solo traduce. |
| Quién hizo el cambio | La API ejecuta `SET LOCAL carnave.usuario_id = '<id>'` en cada transacción. Los triggers de auditoría lo leen con `usuario_actual()` (NULL = proceso automático). |
| Métricas | Dominio `metrica`: `temperatura`, `humedad`, `co2`, `amoniaco`. Lo usan `regla_alerta`, `alerta` y `lectura`. |
| Emails | `CITEXT`: `Admin@Carnave.com` y `admin@carnave.com` son el mismo usuario. |

## Estructura física

- **`granja`**: nombre, ubicación y `activo` (baja = desactivar, ver abajo).
- **`gateway`**: el Raspberry Pi de cada granja. Tiene `identificador`, `token_hash` (autentica la ingesta; nunca se guarda el token) y `ultima_sincronizacion`. Hay un solo Pi activo por granja; si se reemplaza, se desactiva el anterior.
- **`galpon`**: `estado_operativo` (`produccion` | `limpieza` | `disponible`) más `fecha_inicio_limpieza` y `fecha_fin_limpieza_estimada`. Esas dos fechas **solo tienen valor mientras está en limpieza** (lo exige un CHECK). El histórico de estados queda en `galpon_estado_historial`. También tiene `activo` (baja = desactivar, ver abajo).
- **`nodo`**: el ESP32 del galpón. Tiene `identificador` (MAC), `firmware_version` y `ultima_conexion`, que actualiza la ingesta. Hay **un nodo activo por galpón** (decisión #1); si se cambia el equipo, se desactiva el anterior.

**Salud del nodo** (`estado_nodo(ultima_conexion)`), con umbrales en `configuracion_sistema`:

| Estado | Condición |
|---|---|
| `online` | reportó hace menos de `nodo_retrasado_seg` (300 s) |
| `retrasado` | entre 300 s y `nodo_caido_seg` (900 s) |
| `caido` | 900 s o más, o nunca reportó |

## Galpón: transiciones validadas por la base

| De | A | Cómo |
|---|---|---|
| `disponible` | `produccion` | Automático al insertar el lote. |
| `produccion` | `limpieza` | Automático al finalizar el lote. Se completan `fecha_inicio_limpieza` = fin real del lote y `fecha_fin_limpieza_estimada` = + `dias_limpieza_estimados` (15, provisional). |
| `limpieza` | `disponible` | Manual ("limpieza terminada"). Se limpian las fechas de limpieza. |
| `limpieza` | `produccion` | Automático al insertar un lote: cargar el lote da la limpieza por terminada (decisión #33). Se limpian las fechas de limpieza. |

Cualquier otra transición la rechaza el trigger (`CN409`). En particular, un galpón no puede pasar a `produccion` sin lote activo ni salir de `produccion` con uno activo. "Producción sin lote" es imposible a nivel base, no solo por convención (decisión #7). Cada cambio queda en `galpon_estado_historial` con el usuario, o NULL si fue automático.

**Efecto sobre el motor:** fuera de `produccion` no se evalúan reglas ambientales. La salud del nodo (`nodo_caido` y `dato_retrasado`) se evalúa **siempre**.

## Altas y bajas de granjas y galpones

Las administra el admin desde la pestaña "Granjas" (decisión #35). **La baja es desactivar (`activo = false`), nunca `DELETE`**: lotes, lecturas, alertas y asignaciones apuntan al galpón y guardan la historia.

- **Alta:** una granja nace activa. Un galpón nace activo y `disponible`, y solo en una granja activa (`CN409` si no).
- **Nombres:** se guardan sin espacios de borde y no pueden quedar vacíos. Son únicos sin distinguir mayúsculas entre las granjas activas y entre los galpones activos de una misma granja. Los controlan índices únicos parciales, así que un repetido da `23505` y la API lo traduce a `409`. Un nombre dado de baja queda libre.
- **Un galpón no cambia de granja** (`CN400`).
- **Baja de galpón:** no se puede en `produccion` (`CN409`; primero se finaliza el lote). Un trigger aplica los efectos: desactiva su nodo, borra sus filas de `usuario_galpon` y resuelve automáticamente sus alertas abiertas (quedan como `resuelta` en `alerta_historial`, sin usuario). Un galpón inactivo no admite lotes nuevos ni asignaciones de encargados. Si estaba en `limpieza`, queda así hasta que se reactive.
- **Baja de granja:** solo si no le quedan galpones activos (`CN409`).
- **Reactivar:** un galpón solo se reactiva si su granja está activa. Alta de galpón, reactivación y baja de la granja se serializan con `FOR SHARE` sobre la fila de la granja, así que dos operaciones simultáneas no pueden dejar un galpón activo en una granja inactiva.

## Usuarios y notificaciones

- **`usuario`**: rol `admin` | `encargado`, `password_hash` (argon2id), `telefono` en formato E.164 (`+549…`; NULL = no recibe SMS) y `telegram_chat_id` (NULL = no recibe Telegram).
- **`usuario_galpon`**: galpones asignados a cada encargado. El admin ve todo sin filas acá. Solo se asignan galpones activos (`CN400`).
- **`usuario_dispositivo_push`**: tokens de Firebase Cloud Messaging (uno por celular).
- **`notificacion`**: log de cada aviso enviado. Guarda canal (`sms` | `telegram` | `push`), motivo (`critica` | `escalada`), destino, estado e intentos. Tiene `UNIQUE (alerta, usuario, canal, motivo)`: **cada persona recibe cada aviso por cada canal una sola vez**, aunque el Pi y la nube reintenten. Un trigger impide mandar SMS de una alerta que no es crítica.

Quién recibe qué (provisional, decisión #22):

| Motivo | Destinatarios | Canales |
|---|---|---|
| La alerta nace o pasa a `critica` | encargados asignados al galpón | SMS (sale del Pi por GSM, funciona sin internet) + Telegram + push |
| La alerta se escala (30 min sin reconocer) | encargados asignados + todos los admin | Telegram + push (sin SMS: el SMS queda reservado a lo crítico) |

## Lote

Columnas: `numero` (opcional, 1 a 20 caracteres, lo exige un CHECK), `fecha_inicio`, `fecha_fin_estimada`, `fecha_fin_real`, `estado`, `cantidad_aves_inicial`, `linea_genetica`, `notas`, `created_by` y `finalizado_por`.

- **Estados: solo `activo` y `finalizado`** (decisión #24). Un lote nace activo y el default es `activo`. No existen `planificado` ni `cancelado`: nadie los usaba y dejaban un camino por el que el galpón podía quedar inconsistente.
- **Sin fechas futuras:** `fecha_inicio <= hoy_ar()`. Sí se permite cargar un lote que empezó días atrás. Así la edad nunca es negativa.
- **Máximo un lote activo por galpón:** índice único parcial. El alta además bloquea la fila del galpón (`FOR UPDATE`), así que dos altas simultáneas no pueden pasar las dos.
- **Dónde se puede crear:** en un galpón activo, `disponible` o en `limpieza` (en ese caso la limpieza termina sola). En `produccion` o en un galpón dado de baja, no.
- **Finalizar:** un trigger BEFORE completa `fecha_fin_real` (hoy) y `finalizado_por` (usuario de la sesión). Uno AFTER pasa el galpón a limpieza. Un lote finalizado ya no se modifica.
- **Edad:** `edad_dias(lote_id)` = `hoy_ar() - fecha_inicio`. El día de inicio es el día 0.

## Reglas de alerta

`regla_alerta`: métrica, `rango_edad` (`INT4RANGE`), umbrales min/max de warning y crítico, `histeresis`, `tiempo_persistencia_seg`, `granja_id` (NULL = global), `activo`, `reemplaza_a`, `created_by` y `desactivada_at`.

- **Umbrales coherentes (CHECK):**
  - Hay al menos un warning.
  - Un crítico de un lado requiere el warning de ese lado y queda por fuera de él (`min_critico < min_warning`, `max_critico > max_warning`).
  - `min_warning < max_warning`.
- **Criterio de umbral inclusivo** (decisión #28): **alcanzar** el umbral ya dispara (`valor >= max`, `valor <= min`). Para volver a normal, el valor tiene que retroceder la `histeresis` más allá del umbral.
- **Sin huecos de edad:** la última regla de cada métrica es abierta (`'[22,)'`). La vista `v_cobertura_reglas` dice, por métrica, si las reglas globales activas cubren `[0, ∞)`. La API de administración no deja desactivar una regla si eso deja un hueco.
- **Sin superposición:** `EXCLUDE` (requiere `btree_gist`) entre reglas activas de la misma métrica y el mismo alcance. Un override de granja sí se superpone con la global; es su propósito.
- **Inmutables** (decisión #21): un trigger rechaza editar umbrales o borrar. Para cambiar una regla, `reemplazar_regla(id, …)` desactiva la vieja e inserta la nueva con `reemplaza_a` en una sola transacción. Las alertas viejas siguen apuntando a los umbrales que las dispararon.

**Regla aplicable**: `regla_vigente(granja_id, metrica, edad)`.

```sql
WHERE metrica = :m AND activo AND rango_edad @> :edad
  AND (granja_id = :granja_del_galpon OR granja_id IS NULL)   -- solo SU granja o globales
ORDER BY granja_id NULLS LAST                                  -- el override gana
LIMIT 1
```

El filtro por granja es obligatorio. Sin él, un override de otra granja podía ganarle a la regla global.

## Alertas

`alerta`: `id UUID`, `tipo`, galpón, nodo, lote, regla, métrica, `valor_leido`, las fechas del ciclo, quién reconoció y quién resolvió, `resolucion_automatica`, `origen` (`gateway` | `nube`) y `gateway_id`.

**Tipos** (decisión #18). Cada uno lleva datos distintos, y un CHECK exige la combinación exacta:

| Tipo | Cuándo | Lleva | Severidad inicial |
|---|---|---|---|
| `ambiental` | Métrica fuera de umbral (solo en `produccion`) | métrica, regla, valor, lote | `warning` o `critica` según el valor |
| `nodo_caido` | ESP32 sin reportar ≥ `nodo_caido_seg` | nodo | `critica` (provisional) |
| `dato_retrasado` | Nodo vivo pero una métrica sin lectura ≥ `dato_retrasado_seg` (sensor o bus Modbus) | métrica | `warning` (provisional) |

**Estado y severidad no se escriben: se derivan de las fechas** (columnas generadas):

- `severidad` = `critica` si hay `fecha_critica`; si no, `warning`.
- `estado` = `resuelta` > `reconocida` > `escalada` > `activa`, según qué fechas estén completas.

Por qué: no puede existir una alerta "resuelta" sin fecha de resolución, la severidad nunca baja (una fecha puesta no se borra) y sincronizar con el Pi es unir fechas (ver [`06-sincronizacion.md`](06-sincronizacion.md)).

Reglas que la base hace cumplir:

- Una sola alerta **viva** (sin `fecha_resolucion`) por galpón + tipo + métrica. Evita duplicados sin bloquear que convivan, por ejemplo, un `nodo_caido` y un `ambiental` del mismo galpón.
- Reconocer siempre lo hace una persona (`fecha_reconocimiento` ⇔ `reconocida_por`).
- Al resolver hay dos casos: la resolvió una persona (`resuelta_por`) o fue automática (`resolucion_automatica`), nunca las dos cosas.
- Ninguna fecha es anterior a `fecha_disparo`. Una fecha puesta no cambia. Una alerta resuelta ya no cambia.

**Modelo de severidad** (decisión #5, sin cambios):

- Nace en `critica` si el primer valor ya cae en zona crítica. En ese caso `fecha_critica = fecha_disparo`.
- Nace en `warning` si solo cruza el umbral de warning.
- Sube a `critica` si, mientras sigue viva, una lectura entra en zona crítica. Se completa `fecha_critica` en la misma fila y no se crea una alerta nueva.
- En los dos casos de crítica se dispara el SMS, una sola vez por destinatario (lo garantiza `notificacion`).

**Ciclo de estados:**

- `activa → escalada`: lo hace el job a los `tiempo_escalada_seg` (1800 s) si nadie la reconoció.
- `activa` o `escalada → reconocida`: lo hace una persona.
- Cualquier estado → `resuelta`: una persona o la histéresis.

### `alerta_historial`

Log de eventos: `disparada`, `critica`, `escalada`, `reconocida`, `resuelta`, cada uno con `ts` y usuario. **Lo escribe solo un trigger, a partir de las fechas que se completan**, con la hora real del evento, no la de sincronización. Si el Pi sube de una vez una alerta que se escaló y se reconoció offline, quedan los dos eventos en orden. `UNIQUE (alerta_id, evento)` evita duplicados en los reenvíos.

## Configuración

`configuracion_sistema` (clave → valor, con `updated_by`):

| Clave | Valor | Uso |
|---|---|---|
| `tiempo_escalada_seg` | 1800 | Escalada (decisión #12) |
| `nodo_retrasado_seg` | 300 | Estado del nodo |
| `nodo_caido_seg` | 900 | Estado del nodo + alerta `nodo_caido` |
| `dato_retrasado_seg` | 600 | Alerta `dato_retrasado` |
| `dias_limpieza_estimados` | 15 | Fin estimado de limpieza (**provisional**) |

## Lecturas

`lectura (ts, galpon_id, lote_id, metrica, valor, origen)`, con PK `(galpon_id, metrica, ts)`. Es una hypertable con chunks de 1 día.

- `lote_id` es un snapshot del lote activo al leer (decisión #4).
- `origen = 'buffered'` (llegó tarde desde el buffer) **no pasa por el motor de alarmas**, para no generar falsos positivos retroactivos. Sí se grafica.
- La PK hace idempotente el reenvío (`ON CONFLICT DO NOTHING`).
- **Compresión a los 16 días**, segmentada por galpón y métrica. Son 16 y no 7 como decía la decisión #14 porque el Pi guarda hasta 15 días de buffer: con 16, los datos atrasados siempre caen en chunks sin comprimir (decisión #31).
- **`lectura_1h`** es un agregado continuo por hora (promedio, mínimo, máximo y cantidad) para los gráficos de 7 días y de lote completo. Tiene `materialized_only = false`, así que la última hora se completa en vivo. La política refresca las últimas 3 horas; cuando el Pi sube datos atrasados, la ingesta refresca ese rango a mano (ver `06-sincronizacion.md`).
- Retención de la lectura cruda: pendiente (decisión abierta).
