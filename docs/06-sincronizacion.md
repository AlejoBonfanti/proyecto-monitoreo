# Sincronización Pi ↔ nube — Carnave

El Pi de cada granja evalúa alertas y guarda datos **aunque no haya internet** (local-first). Al volver la conexión, sincroniza con la nube, que es la fuente de verdad. Este documento fija qué vive en cada lado y cómo se concilian los cambios sin conflictos.

## Quién es dueño de qué

| Dato | Se crea en | Viaja | Notas |
|---|---|---|---|
| Lecturas | Pi (vía MQTT desde el ESP32) | Pi → nube | Idempotentes por PK `(galpon_id, metrica, ts)` |
| `ultima_conexion` del nodo | Pi | Pi → nube | La nube guarda el máximo recibido |
| Alertas (todas) | Pi (motor local) | Pi ↔ nube | UUID generado en el Pi |
| Reconocer / resolver a mano | Nube (pantalla) | nube → Pi | El Pi necesita saberlo para no escalar una alerta ya reconocida |
| Notificaciones SMS | Pi (módulo GSM) | Pi → nube | UUID generado en el Pi |
| Notificaciones Telegram/push | Nube | — | Necesitan internet |
| Lote, galpón, reglas, config, usuarios asignados | Nube (pantallas/admin) | nube → Pi | El Pi guarda una réplica de solo lectura |

## Base local del Pi (SQLite)

Tablas mínimas (mismos nombres y columnas que en la nube, para que el mapeo sea directo):

- **Réplicas de solo lectura:**
  - `galpon` (id, granja, estado_operativo).
  - `lote` (solo los activos).
  - `regla_alerta` (solo las activas de su granja y las globales).
  - `configuracion_sistema`.
  - `contacto_sms` (usuario_id, teléfono: encargados asignados a los galpones de la granja).
- **`nodo`:** id, galpón, identificador y `ultima_conexion`.
- **`lectura_buffer`:** ts, galpón, métrica, valor, lote_id, origen y `sincronizada` (0/1). Se purga lo sincronizado con más de 15 días.
- **`alerta`:** las mismas columnas que la nube, con `estado` y `severidad` derivados de las fechas, igual que allá. Más `sincronizada` (0/1).
- **`notificacion`:** solo SMS. Lleva `sincronizada` (0/1).
- **`sync_estado`:** última versión de réplica recibida y último envío exitoso.

## Por qué no hay conflictos

En la nube (y en el Pi) una alerta es un conjunto de **fechas que solo se completan, nunca se borran ni cambian**:

- `fecha_critica`, `fecha_escalada`, `fecha_reconocimiento` y `fecha_resolucion`.
- Junto con cada fecha, el dato de quién: `reconocida_por`, y `resuelta_por` o `resolucion_automatica`.

El `estado` y la `severidad` se derivan de ahí. Entonces **conciliar dos versiones de la misma alerta es unir sus fechas**: para cada una, la que ya estaba gana. Es lo que hace `sincronizar_alerta()` en la base (`docs/sql/001_esquema.sql`). El resultado es el mismo sin importar el orden en que lleguen los cambios, y reenviar lo mismo no cambia nada.

Ejemplo: sin internet, el Pi resuelve sola una alerta de nodo caído (volvió el ESP32). Mientras tanto, un encargado la había reconocido desde la nube por 4G. Al sincronizar queda `resuelta`, con el reconocimiento del encargado y la resolución automática del Pi, y los dos eventos en el historial con su hora real.

## Protocolo

Todo por HTTPS, autenticado con el token del gateway (`gateway.token_hash`). El Pi manda en lotes chicos (hasta ~1000 filas por pedido) y solo marca `sincronizada = 1` cuando la nube responde OK.

1. **Subida de lecturas:** `POST /ingesta/lecturas`.
   - La nube hace `INSERT … ON CONFLICT DO NOTHING`.
   - Si el lote incluye lecturas de más de 3 horas atrás, ejecuta `CALL refresh_continuous_aggregate('lectura_1h', min_ts, max_ts)`: la política horaria solo refresca las últimas horas.
   - Actualiza `nodo.ultima_conexion` y `gateway.ultima_sincronizacion`.
2. **Subida de alertas:** `POST /ingesta/alertas`. Por cada una, `sincronizar_alerta()`. La respuesta devuelve la versión conciliada, que el Pi guarda.
3. **Subida de notificaciones SMS:** `POST /ingesta/notificaciones`, con `ON CONFLICT (id) DO NOTHING`.
4. **Bajada:** `GET /ingesta/cambios?desde=<versión>`. Trae:
   - Réplicas (lote, galpón, reglas, config, contactos) cambiadas desde esa versión.
   - Reconocimientos y resoluciones hechos en la nube sobre alertas vivas de la granja.
   - El Pi las aplica con la misma unión de fechas.

Cadencia: la bajada cada 30 s mientras hay conexión, la subida apenas hay datos nuevos, y todo al reconectar.

## Reglas del motor que dependen de esto

- **Datos atrasados no disparan alarmas:** lo que llega con `origen = 'buffered'` se guarda y se grafica, pero no se evalúa (evita falsos positivos retroactivos).
- **El job de escalada no escala una alerta ya reconocida.** Si igual pasa (el reconocimiento llegó tarde al Pi), la unión conserva los dos eventos y el estado queda `reconocida`, por precedencia.
- **La nube no genera alertas ambientales ni de nodo:** las genera el Pi, y así hay una sola fuente de alertas por granja. La nube solo detecta un **Pi sin sincronizar** (decisión abierta: cómo avisarlo).
