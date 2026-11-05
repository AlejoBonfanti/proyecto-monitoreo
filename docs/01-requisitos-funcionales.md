# Requisitos funcionales — Carnave

## 1. Contexto

Sistema de monitoreo ambiental IoT para granjas avícolas de Grupo CEM (Esperanza, Santa Fe). Monitorea temperatura, humedad, CO2 y amoníaco en galpones con pollos de engorde, con ciclos de producción de 45–55 días.

## 2. Actores / roles

Solo dos roles — se evaluó agregar un tercero y se decidió no hacerlo para el piloto (ver `05-decisiones.md`).

- **Admin** — además de todo lo que puede hacer un encargado: gestiona `regla_alerta`, `configuracion_sistema` y altas/bajas de usuarios; ve todos los galpones de todas las granjas sin necesidad de asignación.
- **Encargado** — gestiona el día a día de los galpones que tiene asignados (tabla `usuario_galpon`): reconoce y **resuelve** alertas (ciclo completo), y abre/cierra lotes. No tiene acceso a reglas de alerta ni configuración del sistema.

## 3. Requisitos por pantalla (MVP — 5 pantallas + usuarios)

### 3.1 Login

- Autenticación por usuario/contraseña.
- Enrutamiento post-login según rol.

### 3.2 Dashboard

- Cards de estado por galpón con semáforo por métrica (temperatura, humedad, CO2, amoníaco).
- Refleja `estado_operativo` del galpón (`produccion` / `limpieza` / `disponible`).
- Indicador de nodos ESP32 caídos o con dato retrasado, independiente del estado operativo.

### 3.3 Detalle de galpón

- 4 gráficos de línea en tiempo real (uno por métrica) con overlay de umbrales (warning/crítico) según la `regla_alerta` vigente para la edad del lote activo.
- Datos en tiempo real vía WebSockets.

### 3.4 Alertas

- Tabs de alertas activas / resueltas.
- Acciones disponibles para admin y encargado por igual: reconocer, resolver.
- Cada alerta muestra tipo (ambiental, nodo caído, dato retrasado), severidad (warning/crítica), métrica si corresponde, galpón y estado (`activa`, `escalada` si nadie la reconoce en 30 min, `reconocida`, `resuelta`).

### 3.5 Gestión de lote

- Info del lote activo (número, fecha de inicio, edad calculada, cantidad de aves). La línea genética queda en la base pero no se muestra en el MVP (decisión #15).
- Historial de lotes por galpón.
- Alta de lote nuevo, con fecha de inicio que no puede ser futura (dispara automáticamente `galpon.estado_operativo = produccion`).
- Finalización de lote (dispara automáticamente `estado_operativo = limpieza`, con fecha estimada de fin de limpieza).
- En limpieza: acción "limpieza terminada" (pasa a `disponible`).

### 3.6 Usuarios (solo admin)

- Lista de usuarios con rol, galpones asignados, teléfono para SMS y estado.
- Alta y edición: nombre, email, rol, contraseña (inicial / nueva opcional), teléfono para SMS y galpones asignados (solo encargados).
- Baja = desactivar (no puede entrar; su historial se conserva). Se puede reactivar.
- Un admin no puede darse de baja a sí mismo, y siempre queda al menos un admin activo.
- La pestaña solo aparece para el admin; la página y la API también lo exigen.

## 4. Reglas de negocio clave

- Un galpón tiene como máximo un lote `activo` a la vez, y nunca está en `produccion` sin lote activo (triggers de base).
- El motor de evaluación de alertas de negocio (umbrales ambientales) solo corre si `estado_operativo = produccion`; el monitoreo de salud de nodo (last-seen del ESP32) corre siempre, en cualquier estado.
- Tres tipos de alerta: `ambiental` (umbral), `nodo_caido` (el ESP32 no reporta) y `dato_retrasado` (una métrica no llega).
- Una alerta ambiental nace en `warning` o directamente en `critica` si el salto es grande; puede subir de `warning` a `critica` mientras sigue viva (nunca baja). El SMS se envía una única vez por destinatario, en el momento en que la severidad pasa a (o nace en) `critica`.
- Los umbrales dependen de la edad del lote, contada en días de Argentina; toda edad tiene regla. Alcanzar el umbral ya dispara.
- Datos llegados por buffer (`origen = buffered`, tras una reconexión) no pasan por el motor de alarmas, para evitar falsos positivos retroactivos.
- No puede haber dos alertas vivas (no resueltas) para el mismo galpón + tipo + métrica simultáneamente.
- Ver `03-modelo-datos.md` para el detalle exacto de constraints y `05-decisiones.md` para lo que todavía no está cerrado.

## 5. Requisitos no funcionales

- **Resiliencia local-first:** el Raspberry Pi debe evaluar alertas y bufferear datos (7–15 días en SQLite) de forma independiente de la conectividad a la nube.
- **Conectividad:** Starlink como enlace primario, 4G/LTE como fallback (granjas geográficamente distantes).
- **Escalabilidad:** diseño pensado para pasar de 1 galpón piloto a 100–120 nodos ESP32 en producción completa, reusando el mismo código de plataforma.
- **Volumen:** ~1.4M filas/día estimadas a escala completa (TimescaleDB con hypertables/compresión/aggregates continuos).
