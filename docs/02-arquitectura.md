# Arquitectura — Carnave

## Hardware

- 1 ESP32 por galpón (no 3), sobre bus RS485 Modbus (hasta 1200 m de alcance).
- Sensores industriales en gabinete IP65.
- Módulo GSM solo para SMS — sin sirena, sin display local.
- Raspberry Pi por granja, headless. Pi 4 con 4GB recomendado (2GB desaconsejado).
- Conectividad: Starlink primario, 4G/LTE fallback.

## Stack

- TypeScript de punta a punta: Next.js (App Router) en frontend, Node.js/Express en backend API y en el gateway del Pi.
- C/C++ solo para el firmware del ESP32.
- TimescaleDB (PostgreSQL) en la nube como fuente de verdad.
- SQLite en el Pi como buffer de corto plazo (7–15 días) y cola de sincronización.
- Sin capa NoSQL.
- Tiempo real y notificaciones: WebSockets, Recharts para gráficos, Firebase Cloud Messaging + Telegram Bot API. SMS por el módulo GSM, enviados desde el Pi (funcionan sin internet).
- Zona horaria del negocio: `America/Argentina/Buenos_Aires` en base, Pi y frontend.
- Sin Grafana, sin Node-RED.

## Motor de alertas

- Modelo de severidad híbrido (ver `03-modelo-datos.md` para el detalle exacto).
- Máquina de estados: `activa → escalada` (30 min sin reconocer) → `reconocida` → `resuelta`; se puede reconocer desde `activa` o `escalada` y resolver desde cualquier estado. Estado y severidad se derivan de fechas que solo se completan (ver `03-modelo-datos.md`).
- Tipos de alerta: ambiental, nodo caído y dato retrasado. La salud del nodo se evalúa en cualquier estado operativo.
- Las alertas las genera el Pi (UUID propio) y se concilian con la nube uniendo fechas: ver `06-sincronizacion.md`.
- Auto-resolución por histéresis; throttling para evitar filas de alerta duplicadas.
- Buffer circular en el ESP32 (LittleFS, ~100 registros) con MQTT QoS 1 y flush al reconectar.

## Frontend MVP

5 pantallas: Login, Dashboard, Detalle de Galpón, Alertas, Gestión de Lote (detalle funcional en `01-requisitos-funcionales.md`).

Estructura de carpetas feature/domain-based (`app/`, `features/`, `components/`, `lib/`), TanStack Query, `AuthContext` simple para manejo de rol.

## Principios de diseño (por qué se decidió así)

- La resiliencia local-first no es negociable: el Pi evalúa alertas y buferea datos con independencia de la nube; la nube es fuente de verdad pero no punto único de falla.
- 1 ESP32 por galpón vía RS485 es el tradeoff correcto — el alcance de RS485 elimina el diseño original de 3 nodos por I2C; watchdog reset + monitoreo de last-seen desde el Pi mitigan el riesgo de punto único de falla.
- TimescaleDB cubre la escala completa (~1.4M filas/día) de forma nativa con hypertables, aggregates continuos y compresión — no hace falta split a NoSQL.
- Stack unificado en TypeScript: se prefirió Node.js sobre FastAPI (Python) para mantener un solo lenguaje entre backend, gateway y frontend.
- El estado `produccion` sin lote activo se previene por diseño (transiciones automáticas), no con manejo de errores especial.

## Tooling

- GitHub para todas las capas.
- Docker para servicios de nube y el gateway del Pi (no para el firmware del ESP32).
- MQTT vía broker Mosquitto en el Pi.
- Entorno de desarrollo: Visual Studio.
