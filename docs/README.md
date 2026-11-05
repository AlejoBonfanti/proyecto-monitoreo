# Documentación del proyecto — Carnave

Índice y estado de la documentación técnica del Sistema de Monitoreo Ambiental IoT para Grupo CEM. Estos documentos son la referencia para mantener el desarrollo alineado con lo planeado — antes de programar una funcionalidad nueva, conviene revisar acá primero.

## Índice

- `01-requisitos-funcionales.md` — actores, roles, requisitos por pantalla, reglas de negocio
- `02-arquitectura.md` — hardware, stack, principios de diseño
- `03-modelo-datos.md` — modelo de datos explicado (qué hay y por qué)
- `sql/` — **esquema ejecutable** (fuente única): `001_esquema.sql`, `002_datos_iniciales.sql` y `pruebas.sql`
- `04-api.md` — contrato de la API que consume el frontend
- `05-decisiones.md` — decisiones cerradas y preguntas abiertas pendientes de definir
- `06-sincronizacion.md` — qué vive en el Pi, qué en la nube y cómo se concilian
- `material-fuente/` — documentos y prototipos originales (propuestas comerciales, diagramas, referencia de Mateo, prototipo HTML, especificación técnica completa)

## Estado actual del proyecto (29/09/2026)

- Arquitectura de hardware, stack y modelo de datos definidos. El modelo quedó cerrado como SQL real (`sql/001_esquema.sql`), probado contra PostgreSQL 16 + TimescaleDB, con nodos, gateways, tipos de alerta, notificaciones, sincronización con el Pi y zona horaria resueltos (decisiones #17–#32).
- Frontend Next.js con las 5 pantallas del MVP implementadas sobre una **API simulada** (`src/mocks`), con login, sesión y permisos por rol. Pasar al backend real = definir `API_URL` (ver README del repo).
- Contrato de API fijado en `04-api.md` y cubierto por tests.
- Piloto acotado a un galpón antes del rollout a 100–120 nodos ESP32.

## Próximos pasos

- Cerrar las decisiones abiertas en `05-decisiones.md` — sobre todo los **umbrales reales** con Grupo CEM (bloquea el piloto).
- Implementar el backend (Node/Express) respetando `04-api.md`.
- Tiempo real por WebSocket en el detalle de galpón.
