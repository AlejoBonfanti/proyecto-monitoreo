# Carnave — Frontend

Monitoreo ambiental de galpones para Grupo CEM. Next.js 16 (App Router) + TypeScript + Tailwind v4.

La documentación de producto y arquitectura está en [`docs/`](docs/README.md). El contrato con el backend está en [`docs/04-api.md`](docs/04-api.md).

## Cómo correrlo

```bash
npm install
cp .env.example .env.local   # opcional en desarrollo
npm run dev                  # http://localhost:3000
```

Sin `API_URL` la app funciona contra una **API simulada** (`src/mocks`). Usuarios de demo:

| Usuario | Rol | Contraseña |
|---|---|---|
| `admin@carnave.com` | admin | `carnave123` |
| `encargado@carnave.com` | encargado | `carnave123` |

Los datos simulados viven en memoria: se reinician al reiniciar el servidor.

### Scripts

| Script | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` / `npm start` | Build y servidor de producción (requiere `SESSION_SECRET`) |
| `npm test` / `npm run test:watch` | Tests (Vitest) |
| `npm run typecheck` | Chequeo de tipos |
| `npm run lint` | ESLint |

### Variables de entorno

| Variable | Obligatoria | Descripción |
|---|---|---|
| `API_URL` | No (sí en producción) | URL base del backend, sin `/api/v1`. Vacía → API simulada. |
| `SESSION_SECRET` | En producción | Firma la cookie de sesión. `openssl rand -base64 32`. El servidor no arranca sin ella en producción. |

## Estructura

```
src/
├── app/                    Rutas (solo arman pantallas: piden datos y componen componentes)
│   ├── login/              Pantalla pública (fuera de (app): sin header ni nav)
│   ├── (app)/              Pantallas con sesión: comparten header + nav (layout.tsx)
│   │   ├── page.tsx        Dashboard  →  /
│   │   ├── alertas/        /alertas
│   │   └── galpones/[id]/  /galpones/:id  y  /galpones/:id/lote
│   ├── layout.tsx          HTML raíz, fuentes, globals.css
│   └── not-found.tsx
├── features/               Un módulo por dominio
│   ├── <dominio>/api.ts         Lectura/escritura contra la API (server-only)
│   ├── <dominio>/actions.ts     Server Actions (mutaciones desde formularios)
│   ├── <dominio>/types.ts       Tipos del contrato de API (docs/04-api.md)
│   ├── <dominio>/schemas.ts     Validación de formularios (zod)
│   └── <dominio>/components/    Componentes propios del dominio
├── components/
│   ├── ui/                 Genéricos, sin lógica de negocio (Button, Badge, Card, Field…)
│   └── layout/             Header y navegación
├── lib/
│   ├── api-client.ts       ÚNICO punto que habla con la API (real o simulada)
│   ├── format.ts           ÚNICO lugar donde se formatean valores, fechas y tiempos
│   ├── fechas.ts           Reloj y utilidades de fechas
│   └── env.ts              Lectura de variables de entorno
├── mocks/                  API simulada (se borra cuando exista el backend)
├── proxy.ts                Redirige a /login si no hay sesión (chequeo optimista)
└── instrumentation.ts      Valida la configuración al arrancar
```

El grupo de rutas `(app)` **no aparece en la URL**: sirve para que las pantallas con sesión compartan un layout (header, nav, chequeo de sesión) sin que el login lo herede.

## Reglas del proyecto

1. **Las páginas no saben de dónde vienen los datos.** Llaman a `features/*/api.ts`, que usa `lib/api-client.ts`. Nunca importar `src/mocks` desde una página o componente.
2. **La lógica de negocio es del backend.** Umbrales, severidad, estado del nodo y edad del lote llegan calculados en la respuesta. El frontend solo los muestra.
3. **Fechas como timestamps ISO.** Los "hace 5 min" se calculan al mostrar con `tiempoRelativo()`, nunca se guardan. Los días ("hoy", edad del lote) son siempre de Argentina: usar `lib/fechas.ts`, nunca `getDate()`/`toDateString()` sueltos.
4. **Un solo formateo.** Si un valor se ve distinto en dos pantallas, se corrige en `lib/format.ts`.
5. **Server Components por defecto.** `"use client"` solo para interacción (formularios con estado, selects, confirmaciones).
6. **Mutaciones con Server Actions** (`features/*/actions.ts`): verifican la sesión, llaman a la API y hacen `revalidatePath`.
7. **Autorización real en el servidor.** `proxy.ts` solo redirige; la sesión se verifica en `features/auth/dal.ts` y los permisos los aplica la API.
8. **Tests junto al código** (`*.test.ts`). `src/mocks/api.test.ts` documenta las reglas de negocio que el backend tiene que cumplir.

## Base de datos

El esquema está en `docs/sql/` y se prueba contra PostgreSQL 16 + TimescaleDB:

```bash
createdb carnave_test
psql -d carnave_test -f docs/sql/001_esquema.sql
psql -d carnave_test -f docs/sql/002_datos_iniciales.sql
psql -v ON_ERROR_STOP=1 -d carnave_test -f docs/sql/pruebas.sql   # termina en "OK: todas las pruebas…"
```

## Pasar al backend real

1. Crear la base con `docs/sql/` e implementar los endpoints de `docs/04-api.md` (los tests de `src/mocks/api.test.ts` describen el comportamiento esperado).
2. Definir `API_URL` y `SESSION_SECRET`.
3. Sacar el aviso de credenciales de demo de `src/app/login/page.tsx`, borrar `src/mocks/` y la rama de mocks en `lib/api-client.ts`.
