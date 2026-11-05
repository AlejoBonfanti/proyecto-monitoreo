# Decisiones — Carnave

## Cerradas

| # | Tema | Decisión |
|---|---|---|
| 1 | Nodos por galpón | 1 ESP32 por galpón vía RS485 (no 3 por I2C) |
| 2 | Stack | TypeScript end-to-end (Next.js + Node/Express); C/C++ solo firmware |
| 3 | Base de datos | TimescaleDB en la nube, SQLite como buffer en el Pi; sin NoSQL |
| 4 | `lote_id` en `lectura` | Denormalizado (snapshot al insertar) |
| 5 | Severidad de alerta | Modelo híbrido: nace en `warning` o directo en `critica`; sube de `warning` a `critica` si empeora; SMS una sola vez, en el momento en que pasa a `critica` |
| 6 | Node health en `limpieza`/`disponible` | Sigue activo siempre; solo se pausan las alertas de negocio |
| 7 | `produccion` sin lote activo | No se maneja como caso especial — las transiciones automáticas lo evitan por diseño |
| 8 | Timeout de escalada | Va en `configuracion_sistema` (tunable sin tocar código), no hardcodeado |
| 9 | Permisos del encargado sobre alertas | Reconoce **y** resuelve — ciclo completo, sin depender de un admin disponible (28/09/2026) |
| 10 | Permisos del encargado sobre lotes | Gestión completa: abre y cierra lotes de los galpones que tiene asignados (28/09/2026) |
| 11 | Roles del sistema | Solo dos: `admin` y `encargado`. No se agrega un tercer rol para el piloto (28/09/2026) |
| 12 | Timeout de escalada — valor exacto | **30 min (1800 seg)**, reemplaza el placeholder de 35 min de la especificación original (28/09/2026) |
| 13 | Tablas `granja` y `usuario` | Definidas en `03-modelo-datos.md`, con `usuario_galpon` para las asignaciones de un encargado |
| 14 | Agregados continuos de TimescaleDB | `lectura_1h` (bucket de 1h, promedio/min/max/cantidad) + política de compresión sobre `lectura` (a 16 días desde la #31); detalle en `03-modelo-datos.md` |
| 15 | Número de lote | Campo `lote.numero` opcional (texto, máx. 20), lo carga admin o encargado al crear el lote. No se muestra `lote_id` ni línea genética en las pantallas del MVP (28/09/2026) |
| 16 | Contrato de API | `04-api.md` pasa de borrador a contrato: implementado en la API simulada del frontend (`src/mocks/api.ts`) y cubierto por tests. JSON en camelCase, fechas ISO (nunca tiempos relativos), umbrales/severidad/estado de nodo resueltos por el backend (28/09/2026) |
| 17 | Nodos y gateways en la base | Tablas `nodo` (1 ESP32 activo por galpón, `ultima_conexion`) y `gateway` (1 Pi activo por granja, token de ingesta). Estado del nodo: online < 5 min, retrasado < 15 min, caído; umbrales en `configuracion_sistema` (29/09/2026) |
| 18 | Tipos de alerta | `ambiental`, `nodo_caido`, `dato_retrasado` en la misma tabla `alerta`, con CHECK de qué datos lleva cada uno. `nodo_caido` nace crítica y `dato_retrasado` en warning (**provisional**) (29/09/2026) |
| 19 | IDs y sincronización de alertas | `alerta.id` es UUID generado en el origen (Pi o nube). Estado y severidad se derivan de las fechas; sincronizar = unir fechas (`sincronizar_alerta()`), sin conflictos. Detalle en `06-sincronizacion.md` (29/09/2026) |
| 20 | Regla aplicable | `regla_vigente()` filtra por la granja del galpón o globales; antes el override de otra granja podía ganar (bug corregido) (29/09/2026) |
| 21 | Reglas inmutables | Las reglas no se editan ni se borran: se reemplazan (`reemplazar_regla()`, columna `reemplaza_a`) y se desactivan. La auditoría de alertas viejas queda intacta (29/09/2026) |
| 22 | Notificaciones | `usuario.telefono` (E.164) y `telegram_chat_id`, tabla `usuario_dispositivo_push` y log `notificacion` con unicidad por alerta + usuario + canal + motivo. Crítica → encargados asignados por SMS (desde el Pi) + Telegram + push; escalada → encargados + admins por Telegram + push (**destinatarios provisionales**) (29/09/2026) |
| 23 | Zona horaria | `America/Argentina/Buenos_Aires` en la base (`hoy_ar()`), en el Pi y en el frontend. La edad del lote y "hoy" no dependen de la zona del servidor (29/09/2026) |
| 24 | Estados de lote | Solo `activo` y `finalizado` (se quitan `planificado` y `cancelado`). `fecha_inicio` no puede ser futura (29/09/2026) |
| 25 | Transiciones del galpón | Validadas por triggers en la base; `produccion` sin lote activo es imposible. Al finalizar un lote se completan `fecha_inicio_limpieza` y `fecha_fin_limpieza_estimada` (+15 días, **provisional**); al pasar a disponible se limpian (29/09/2026) |
| 26 | Restricciones de datos | Dominio `metrica` en todas las tablas, `lote.numero` ≤ 20 por CHECK, umbrales ordenados (crítico por fuera del warning), email `CITEXT`, extensión `btree_gist` declarada (29/09/2026) |
| 27 | Historial de alertas | `alerta_historial` por eventos (`disparada`, `critica`, `escalada`, `reconocida`, `resuelta`), escrito solo por trigger a partir de las fechas, con la hora real del evento (29/09/2026) |
| 28 | Criterio de umbral y cobertura | Alcanzar el umbral dispara (≥ / ≤). El último rango de edad de cada métrica es abierto (`[22,)`) y `v_cobertura_reglas` impide dejar edades sin regla (29/09/2026) |
| 29 | Query params | camelCase también en la query (`?galponId=`), igual que el JSON (29/09/2026) |
| 30 | Auditoría | `lote.finalizado_por`, `galpon_estado_historial` (por trigger) y `SET LOCAL carnave.usuario_id` por transacción para saber quién hizo cada cambio (29/09/2026) |
| 31 | Compresión y agregado | Compresión de `lectura` a los **16 días** (reemplaza los 7 de la #14) para que el buffer del Pi (hasta 15 días) no caiga en chunks comprimidos. `lectura_1h` con tiempo real y refresco explícito al recibir datos atrasados (29/09/2026) |
| 32 | Fuente del modelo | El esquema ejecutable en `docs/sql/001_esquema.sql` es la fuente única, probado contra PostgreSQL 16 + TimescaleDB con `docs/sql/pruebas.sql`; `03-modelo-datos.md` lo explica (29/09/2026) |
| 33 | Lote desde limpieza | Se puede crear un lote con el galpón en `limpieza`: la limpieza termina automáticamente (`limpieza → produccion`). "Limpieza terminada" queda como acción opcional para dejar el galpón `disponible` sin cargar lote. Admin y encargado por igual (29/09/2026) |
| 34 | ABM de usuarios | Pantalla solo para admin: alta, edición, asignación de galpones y teléfono para SMS. La baja es desactivar, nunca borrar. Un admin no puede darse de baja ni dejar el sistema sin admin activo. **Sin Telegram**: no se va a implementar, así que no aparece en la pantalla (29/09/2026) |
| 35 | ABM de granjas y galpones | Pestaña "Granjas", solo para admin: alta, edición y baja de granjas y, dentro de cada una, de sus galpones. La baja es desactivar (`activo = false`) y nunca se borra, porque lotes, lecturas, alertas y asignaciones guardan la historia. Reglas: un galpón en `produccion` no se puede dar de baja; una granja con galpones activos tampoco. El nombre del galpón es único entre los activos de su granja. De un galpón solo se edita el `nombre`: el estado sigue manejándose por lotes y no se lo mueve de granja. Al darlo de baja se desactiva su nodo, se quitan sus asignaciones de `usuario_galpon` y sus alertas abiertas se resuelven automáticamente (29/09/2026) |

Con la decisión #9–11, `admin` y `encargado` terminan con los mismos permisos funcionales sobre `lote` y `alerta`. Lo que sigue siendo exclusivo de `admin`: gestionar `regla_alerta`, `configuracion_sistema`, altas y bajas de usuarios y de granjas y galpones, y ver todos los galpones sin necesidad de estar en `usuario_galpon`.

## Abiertas

| # | Tema | Estado |
|---|---|---|
| 1 | Endpoints de API formales | Validados contra el frontend con la API simulada (#16). Falta confirmarlos al implementar el backend real, más WebSocket de tiempo real y la pantalla de historial de alerta |
| 2 | **Umbrales reales por edad** | Los de `002_datos_iniciales.sql` son de ejemplo. Validar con Grupo CEM / su veterinario temperatura, humedad, CO2 y amoníaco por rango de edad, histéresis y tiempo de persistencia. **Bloquea el piloto** |
| 3 | Destinatarios de notificaciones | Propuesta en #22. Confirmar con Grupo CEM quién recibe SMS (¿solo encargados o también admin?), si la escalada también manda SMS y teléfonos reales |
| 4 | Severidad de alertas de equipo | Propuesta en #18: `nodo_caido` crítica, `dato_retrasado` warning. Confirmar |
| 5 | Días de limpieza estimados | 15 días provisional (#25). Confirmar la duración típica de limpieza y vacío sanitario |
| 6 | Retención de lectura cruda | Cuánto histórico a resolución completa guardar antes de purgar (`add_retention_policy`). No bloqueante |
| 7 | Aviso de Pi sin sincronizar | La nube detecta un gateway sin sincronizar (`gateway.ultima_sincronizacion`), pero no puede crear una alerta por galpón sin duplicar lo que hace el Pi. Definir si se avisa por Telegram/push a los admin y con qué umbral |

Nota: si con el uso del piloto aparece la necesidad real de un rol intermedio (decisión #11) o de ajustar el timeout de 30 min (decisión #12), son cambios de bajo impacto — no requieren volver a tocar el modelo de datos.
