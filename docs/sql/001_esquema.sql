-- =============================================================================
-- Carnave — esquema de la base en la nube (PostgreSQL 16 + TimescaleDB 2.x)
--
-- Fuente única del modelo de datos. docs/03-modelo-datos.md explica el porqué
-- de cada decisión; si el .md y este archivo difieren, manda este archivo
-- (está probado con docs/sql/pruebas.sql).
--
-- Convenciones:
--   * Errores de negocio con SQLSTATE propios, para que la API los traduzca:
--       CN400 → HTTP 400 (dato inválido)   CN409 → HTTP 409 (transición no permitida)
--   * Quién hizo un cambio: la API ejecuta `SET LOCAL carnave.usuario_id = '<id>'`
--     al inicio de cada transacción. Los triggers de auditoría lo leen.
--   * Fechas de negocio ("hoy", edad del lote) siempre en hora argentina: hoy_ar().
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS btree_gist;  -- EXCLUDE de regla_alerta (= sobre texto/bigint)
CREATE EXTENSION IF NOT EXISTS citext;      -- email sin distinguir mayúsculas

-- Zona horaria del negocio para las sesiones de esta base.
DO $$ BEGIN
    EXECUTE format('ALTER DATABASE %I SET timezone = %L', current_database(), 'America/Argentina/Buenos_Aires');
END $$;
SET timezone = 'America/Argentina/Buenos_Aires';

-- -----------------------------------------------------------------------------
-- Utilidades
-- -----------------------------------------------------------------------------

-- "Hoy" en Argentina, independiente de la zona de la sesión o del servidor.
CREATE FUNCTION hoy_ar() RETURNS DATE
LANGUAGE sql STABLE AS $$
    SELECT (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
$$;

-- Usuario que la API declaró para la transacción actual (NULL = proceso automático).
CREATE FUNCTION usuario_actual() RETURNS BIGINT
LANGUAGE sql STABLE AS $$
    SELECT NULLIF(current_setting('carnave.usuario_id', true), '')::bigint
$$;

CREATE DOMAIN metrica AS TEXT
    CHECK (VALUE IN ('temperatura', 'humedad', 'co2', 'amoniaco'));

-- -----------------------------------------------------------------------------
-- Configuración global (tuneable sin tocar código)
-- -----------------------------------------------------------------------------

CREATE TABLE configuracion_sistema (
    clave       TEXT PRIMARY KEY,
    valor       TEXT NOT NULL,
    descripcion TEXT,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by  BIGINT  -- FK a usuario se agrega más abajo (usuario todavía no existe)
);

INSERT INTO configuracion_sistema (clave, valor, descripcion) VALUES
    ('tiempo_escalada_seg',      '1800', 'Alerta sin reconocer pasa a escalada (30 min, decisión #12)'),
    ('nodo_retrasado_seg',       '300',  'ESP32 sin reportar: a partir de acá el nodo figura "retrasado"'),
    ('nodo_caido_seg',           '900',  'ESP32 sin reportar: a partir de acá el nodo figura "caído" y se abre alerta nodo_caido'),
    ('dato_retrasado_seg',       '600',  'Nodo vivo pero una métrica sin lectura: se abre alerta dato_retrasado'),
    ('dias_limpieza_estimados',  '15',   'Duración estimada de la limpieza entre lotes (PROVISIONAL, confirmar con Grupo CEM)');

CREATE FUNCTION config_int(p_clave TEXT) RETURNS INTEGER
LANGUAGE sql STABLE AS $$
    SELECT valor::integer FROM configuracion_sistema WHERE clave = p_clave
$$;

-- -----------------------------------------------------------------------------
-- Estructura física: granja, gateway (Pi), galpón, nodo (ESP32)
-- -----------------------------------------------------------------------------

-- Baja = desactivar, nunca borrar (decisión #35): lotes, lecturas y alertas guardan la historia.
CREATE TABLE granja (
    id         BIGSERIAL PRIMARY KEY,
    nombre     TEXT NOT NULL CHECK (btrim(nombre) <> ''),
    ubicacion  TEXT,
    activo     BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Nombre único entre las granjas activas, sin distinguir mayúsculas (los triggers guardan el nombre sin espacios de borde).
CREATE UNIQUE INDEX uq_granja_nombre_activa ON granja (lower(nombre)) WHERE activo;

-- Raspberry Pi de cada granja. Autentica la ingesta con un token propio.
CREATE TABLE gateway (
    id                    BIGSERIAL PRIMARY KEY,
    granja_id             BIGINT NOT NULL REFERENCES granja(id),
    identificador         TEXT NOT NULL UNIQUE,          -- ej. hostname o serial del Pi
    token_hash            TEXT NOT NULL,                 -- hash del token de ingesta (nunca el token)
    version_software      TEXT,
    ultima_sincronizacion TIMESTAMPTZ,
    activo                BOOLEAN NOT NULL DEFAULT true,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Un Pi activo por granja (si se reemplaza, se desactiva el anterior).
CREATE UNIQUE INDEX uq_gateway_activo_por_granja ON gateway (granja_id) WHERE activo;

CREATE TABLE galpon (
    id                          BIGSERIAL PRIMARY KEY,
    granja_id                   BIGINT NOT NULL REFERENCES granja(id),
    nombre                      TEXT NOT NULL CHECK (btrim(nombre) <> ''),
    estado_operativo            TEXT NOT NULL DEFAULT 'disponible'
                                 CHECK (estado_operativo IN ('produccion', 'limpieza', 'disponible')),
    -- Solo tienen valor mientras el galpón está en limpieza (el histórico queda en galpon_estado_historial).
    fecha_inicio_limpieza       DATE,
    fecha_fin_limpieza_estimada DATE,
    activo                      BOOLEAN NOT NULL DEFAULT true,   -- baja = desactivar (decisión #35)
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CHECK ((estado_operativo = 'limpieza') = (fecha_inicio_limpieza IS NOT NULL)),
    CHECK (fecha_fin_limpieza_estimada IS NULL OR fecha_inicio_limpieza IS NOT NULL),
    CHECK (fecha_fin_limpieza_estimada IS NULL OR fecha_fin_limpieza_estimada >= fecha_inicio_limpieza),
    -- Un galpón dado de baja nunca está en producción.
    CHECK (activo OR estado_operativo <> 'produccion')
);
-- Nombre único entre los galpones activos de la misma granja, sin distinguir mayúsculas.
CREATE UNIQUE INDEX uq_galpon_nombre_activo_por_granja ON galpon (granja_id, lower(nombre)) WHERE activo;

-- ESP32 del galpón. La salud del nodo se calcula con ultima_conexion (la actualiza la ingesta).
CREATE TABLE nodo (
    id               BIGSERIAL PRIMARY KEY,
    galpon_id        BIGINT NOT NULL REFERENCES galpon(id),
    identificador    TEXT NOT NULL UNIQUE,   -- MAC del ESP32
    firmware_version TEXT,
    ultima_conexion  TIMESTAMPTZ,            -- NULL = nunca reportó
    activo           BOOLEAN NOT NULL DEFAULT true,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- 1 ESP32 activo por galpón (decisión #1). Si se cambia el equipo, se desactiva el anterior.
CREATE UNIQUE INDEX uq_nodo_activo_por_galpon ON nodo (galpon_id) WHERE activo;

-- Estado del nodo según last-seen, con los umbrales de configuracion_sistema.
CREATE FUNCTION estado_nodo(p_ultima_conexion TIMESTAMPTZ) RETURNS TEXT
LANGUAGE sql STABLE AS $$
    SELECT CASE
        WHEN p_ultima_conexion IS NULL THEN 'caido'
        WHEN now() - p_ultima_conexion < make_interval(secs => config_int('nodo_retrasado_seg')) THEN 'online'
        WHEN now() - p_ultima_conexion < make_interval(secs => config_int('nodo_caido_seg'))     THEN 'retrasado'
        ELSE 'caido'
    END
$$;

-- -----------------------------------------------------------------------------
-- Usuarios, asignaciones y canales de notificación
-- -----------------------------------------------------------------------------

CREATE TABLE usuario (
    id               BIGSERIAL PRIMARY KEY,
    nombre           TEXT NOT NULL,
    email            CITEXT NOT NULL UNIQUE,
    password_hash    TEXT NOT NULL,          -- argon2id / bcrypt, nunca texto plano
    rol              TEXT NOT NULL CHECK (rol IN ('admin', 'encargado')),
    telefono         TEXT CHECK (telefono ~ '^\+[1-9][0-9]{7,14}$'),  -- E.164 (+549...). NULL = no recibe SMS
    telegram_chat_id TEXT,                    -- NULL = no recibe Telegram
    activo           BOOLEAN NOT NULL DEFAULT true,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE configuracion_sistema
    ADD CONSTRAINT configuracion_sistema_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES usuario(id);

-- Galpones asignados a un encargado. El admin ve todo y no necesita filas acá.
CREATE TABLE usuario_galpon (
    usuario_id BIGINT NOT NULL REFERENCES usuario(id),
    galpon_id  BIGINT NOT NULL REFERENCES galpon(id),
    PRIMARY KEY (usuario_id, galpon_id)
);

-- Tokens de Firebase Cloud Messaging (un usuario puede tener varios celulares).
CREATE TABLE usuario_dispositivo_push (
    id         BIGSERIAL PRIMARY KEY,
    usuario_id BIGINT NOT NULL REFERENCES usuario(id),
    fcm_token  TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ultimo_uso TIMESTAMPTZ
);

-- -----------------------------------------------------------------------------
-- Lote
-- -----------------------------------------------------------------------------

CREATE TABLE lote (
    id                    BIGSERIAL PRIMARY KEY,
    galpon_id             BIGINT NOT NULL REFERENCES galpon(id),
    numero                TEXT CHECK (numero IS NULL OR char_length(numero) BETWEEN 1 AND 20),
    fecha_inicio          DATE NOT NULL,
    fecha_fin_estimada    DATE NOT NULL,
    fecha_fin_real        DATE,
    estado                TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'finalizado')),
    cantidad_aves_inicial INTEGER NOT NULL CHECK (cantidad_aves_inicial > 0),
    linea_genetica        TEXT,
    notas                 TEXT,
    created_by            BIGINT NOT NULL REFERENCES usuario(id),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    finalizado_por        BIGINT REFERENCES usuario(id),

    CHECK (fecha_fin_estimada > fecha_inicio),
    CHECK ((estado = 'finalizado') = (fecha_fin_real IS NOT NULL)),
    CHECK (fecha_fin_real IS NULL OR fecha_fin_real >= fecha_inicio)
);

-- Un solo lote activo por galpón.
CREATE UNIQUE INDEX uq_lote_activo_por_galpon ON lote (galpon_id) WHERE estado = 'activo';

-- Edad en días del lote, en hora argentina (día 0 = fecha de inicio).
CREATE FUNCTION edad_dias(p_lote_id BIGINT) RETURNS INTEGER
LANGUAGE sql STABLE AS $$
    SELECT (hoy_ar() - fecha_inicio)::integer FROM lote WHERE id = p_lote_id
$$;

-- Alta de lote: nace activo, con fecha de inicio no futura, en un galpón activo y disponible o en limpieza
-- (si está en limpieza, cargar el lote da la limpieza por terminada: decisión #33).
CREATE FUNCTION lote_antes_insertar() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_estado TEXT;
    v_activo BOOLEAN;
BEGIN
    IF NEW.estado <> 'activo' THEN
        RAISE EXCEPTION 'Un lote se crea siempre activo.' USING ERRCODE = 'CN400';
    END IF;
    IF NEW.fecha_inicio > hoy_ar() THEN
        RAISE EXCEPTION 'La fecha de inicio no puede ser futura.' USING ERRCODE = 'CN400';
    END IF;

    -- FOR UPDATE: dos altas simultáneas en el mismo galpón (o un alta y una baja) se serializan acá.
    SELECT estado_operativo, activo INTO v_estado, v_activo FROM galpon WHERE id = NEW.galpon_id FOR UPDATE;
    IF v_estado IS NULL OR NOT v_activo THEN
        RAISE EXCEPTION 'El galpón no existe o está dado de baja.' USING ERRCODE = 'CN409';
    END IF;
    IF v_estado NOT IN ('disponible', 'limpieza') THEN
        RAISE EXCEPTION 'El galpón ya tiene un lote en producción.' USING ERRCODE = 'CN409';
    END IF;

    NEW.created_by := COALESCE(NEW.created_by, usuario_actual());
    RETURN NEW;
END $$;

-- disponible/limpieza → produccion, automático al crear el lote.
CREATE FUNCTION lote_despues_insertar() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE galpon SET estado_operativo = 'produccion' WHERE id = NEW.galpon_id;
    RETURN NULL;
END $$;

-- Un lote finalizado no se toca; al finalizar se completa fecha real y quién.
CREATE FUNCTION lote_antes_actualizar() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.estado = 'finalizado' THEN
        RAISE EXCEPTION 'Un lote finalizado no se puede modificar.' USING ERRCODE = 'CN409';
    END IF;
    IF NEW.galpon_id <> OLD.galpon_id THEN
        RAISE EXCEPTION 'Un lote no cambia de galpón.' USING ERRCODE = 'CN400';
    END IF;
    IF NEW.estado = 'finalizado' THEN
        NEW.fecha_fin_real := COALESCE(NEW.fecha_fin_real, hoy_ar());
        NEW.finalizado_por := COALESCE(NEW.finalizado_por, usuario_actual());
    END IF;
    RETURN NEW;
END $$;

-- produccion → limpieza, automático al finalizar el lote.
CREATE FUNCTION lote_despues_finalizar() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE galpon
       SET estado_operativo            = 'limpieza',
           fecha_inicio_limpieza       = NEW.fecha_fin_real,
           fecha_fin_limpieza_estimada = NEW.fecha_fin_real + config_int('dias_limpieza_estimados')
     WHERE id = NEW.galpon_id;
    RETURN NULL;
END $$;

CREATE TRIGGER trg_lote_antes_insertar    BEFORE INSERT ON lote FOR EACH ROW EXECUTE FUNCTION lote_antes_insertar();
CREATE TRIGGER trg_lote_despues_insertar  AFTER  INSERT ON lote FOR EACH ROW EXECUTE FUNCTION lote_despues_insertar();
CREATE TRIGGER trg_lote_antes_actualizar  BEFORE UPDATE ON lote FOR EACH ROW EXECUTE FUNCTION lote_antes_actualizar();
CREATE TRIGGER trg_lote_despues_finalizar AFTER  UPDATE ON lote FOR EACH ROW
    WHEN (OLD.estado = 'activo' AND NEW.estado = 'finalizado')
    EXECUTE FUNCTION lote_despues_finalizar();

-- -----------------------------------------------------------------------------
-- Transiciones del galpón (validadas en la base) y su historial
-- -----------------------------------------------------------------------------

CREATE TABLE galpon_estado_historial (
    id              BIGSERIAL PRIMARY KEY,
    galpon_id       BIGINT NOT NULL REFERENCES galpon(id),
    estado_anterior TEXT NOT NULL,
    estado_nuevo    TEXT NOT NULL,
    usuario_id      BIGINT REFERENCES usuario(id),  -- NULL = automático
    ts              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Única matriz permitida:
--   produccion → limpieza    solo si el galpón ya no tiene lote activo (lo hace el trigger de lote)
--   limpieza   → disponible  manual (limpieza terminada)
--   disponible → produccion  solo si ya existe el lote activo (lo hace el trigger de lote)
--   limpieza   → produccion  ídem: cargar el lote termina la limpieza (decisión #33)
-- Consecuencia: "produccion sin lote activo" es imposible (decisión #7).
-- Además (decisión #35): el galpón no cambia de granja, no se da de baja en producción
-- y no se reactiva si su granja está dada de baja.
CREATE FUNCTION galpon_antes_actualizar() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_hay_lote BOOLEAN;
BEGIN
    NEW.updated_at := now();
    NEW.nombre := btrim(NEW.nombre);

    IF NEW.granja_id <> OLD.granja_id THEN
        RAISE EXCEPTION 'Un galpón no cambia de granja.' USING ERRCODE = 'CN400';
    END IF;
    IF OLD.activo AND NOT NEW.activo AND OLD.estado_operativo = 'produccion' THEN
        RAISE EXCEPTION 'No se puede dar de baja un galpón en producción: primero finalizá el lote.'
            USING ERRCODE = 'CN409';
    END IF;
    IF NOT OLD.activo AND NEW.activo THEN
        -- FOR SHARE: se serializa con una baja simultánea de la granja.
        PERFORM 1 FROM granja WHERE id = NEW.granja_id AND activo FOR SHARE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'La granja está dada de baja: reactivala primero.' USING ERRCODE = 'CN409';
        END IF;
    END IF;

    IF NEW.estado_operativo = OLD.estado_operativo THEN
        RETURN NEW;
    END IF;

    SELECT EXISTS (SELECT 1 FROM lote WHERE galpon_id = NEW.id AND estado = 'activo') INTO v_hay_lote;

    IF OLD.estado_operativo = 'produccion' AND NEW.estado_operativo = 'limpieza' AND NOT v_hay_lote THEN
        RETURN NEW;
    ELSIF OLD.estado_operativo = 'limpieza' AND NEW.estado_operativo = 'disponible' THEN
        NEW.fecha_inicio_limpieza := NULL;
        NEW.fecha_fin_limpieza_estimada := NULL;
        RETURN NEW;
    ELSIF OLD.estado_operativo IN ('disponible', 'limpieza') AND NEW.estado_operativo = 'produccion' AND v_hay_lote THEN
        NEW.fecha_inicio_limpieza := NULL;
        NEW.fecha_fin_limpieza_estimada := NULL;
        RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Transición de galpón no permitida: % → %.', OLD.estado_operativo, NEW.estado_operativo
        USING ERRCODE = 'CN409';
END $$;

CREATE FUNCTION galpon_registrar_estado() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO galpon_estado_historial (galpon_id, estado_anterior, estado_nuevo, usuario_id)
    VALUES (NEW.id, OLD.estado_operativo, NEW.estado_operativo, usuario_actual());
    RETURN NULL;
END $$;

CREATE TRIGGER trg_galpon_antes_actualizar BEFORE UPDATE ON galpon FOR EACH ROW EXECUTE FUNCTION galpon_antes_actualizar();
CREATE TRIGGER trg_galpon_registrar_estado AFTER UPDATE ON galpon FOR EACH ROW
    WHEN (OLD.estado_operativo IS DISTINCT FROM NEW.estado_operativo)
    EXECUTE FUNCTION galpon_registrar_estado();

-- -----------------------------------------------------------------------------
-- Altas y bajas de granjas y galpones (decisión #35)
-- -----------------------------------------------------------------------------
-- La baja es desactivar (activo = false), nunca DELETE: las FKs de lote, lectura, alerta, etc.
-- lo impiden y además se perdería la historia.

-- Granja: nombre sin espacios de borde; no se da de baja con galpones activos.
CREATE FUNCTION granja_antes_guardar() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    NEW.nombre := btrim(NEW.nombre);
    IF TG_OP = 'INSERT' AND NOT NEW.activo THEN
        RAISE EXCEPTION 'Una granja se crea siempre activa.' USING ERRCODE = 'CN400';
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.activo AND NOT NEW.activo
       AND EXISTS (SELECT 1 FROM galpon WHERE granja_id = NEW.id AND activo) THEN
        RAISE EXCEPTION 'La granja tiene galpones activos: dalos de baja primero.' USING ERRCODE = 'CN409';
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER trg_granja_antes_guardar BEFORE INSERT OR UPDATE ON granja
    FOR EACH ROW EXECUTE FUNCTION granja_antes_guardar();

-- Alta de galpón: nace activo y disponible, en una granja activa.
CREATE FUNCTION galpon_antes_insertar() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    NEW.nombre := btrim(NEW.nombre);
    IF NOT NEW.activo OR NEW.estado_operativo <> 'disponible' THEN
        RAISE EXCEPTION 'Un galpón se crea siempre activo y disponible.' USING ERRCODE = 'CN400';
    END IF;
    -- FOR SHARE: una baja simultánea de la granja espera a que termine esta alta (y después la ve).
    PERFORM 1 FROM granja WHERE id = NEW.granja_id AND activo FOR SHARE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'La granja no existe o está dada de baja.' USING ERRCODE = 'CN409';
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER trg_galpon_antes_insertar BEFORE INSERT ON galpon
    FOR EACH ROW EXECUTE FUNCTION galpon_antes_insertar();

-- Efectos de la baja de un galpón: se desactiva su nodo, se quitan las asignaciones de encargados
-- y sus alertas abiertas se resuelven automáticamente (quedan en alerta_historial como 'resuelta', sin usuario).
CREATE FUNCTION galpon_despues_baja() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE nodo SET activo = false WHERE galpon_id = NEW.id AND activo;
    DELETE FROM usuario_galpon WHERE galpon_id = NEW.id;
    UPDATE alerta
       SET fecha_resolucion      = GREATEST(now(), fecha_disparo),
           resolucion_automatica = true
     WHERE galpon_id = NEW.id AND fecha_resolucion IS NULL;
    RETURN NULL;
END $$;

CREATE TRIGGER trg_galpon_despues_baja AFTER UPDATE ON galpon FOR EACH ROW
    WHEN (OLD.activo AND NOT NEW.activo)
    EXECUTE FUNCTION galpon_despues_baja();

-- No se asigna un encargado a un galpón dado de baja.
CREATE FUNCTION usuario_galpon_validar() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM galpon WHERE id = NEW.galpon_id AND activo) THEN
        RAISE EXCEPTION 'No se puede asignar un galpón dado de baja.' USING ERRCODE = 'CN400';
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER trg_usuario_galpon_validar BEFORE INSERT OR UPDATE ON usuario_galpon
    FOR EACH ROW EXECUTE FUNCTION usuario_galpon_validar();

-- -----------------------------------------------------------------------------
-- Reglas de alerta (inmutables: se reemplazan, no se editan)
-- -----------------------------------------------------------------------------

CREATE TABLE regla_alerta (
    id                      BIGSERIAL PRIMARY KEY,
    metrica                 metrica NOT NULL,
    rango_edad              INT4RANGE NOT NULL,   -- '[0,8)' = días 0 a 7; '[22,)' = día 22 en adelante
    umbral_min_warning      NUMERIC,
    umbral_max_warning      NUMERIC,
    umbral_min_critico      NUMERIC,
    umbral_max_critico      NUMERIC,
    histeresis              NUMERIC NOT NULL DEFAULT 0.5 CHECK (histeresis >= 0),
    tiempo_persistencia_seg INTEGER NOT NULL DEFAULT 60 CHECK (tiempo_persistencia_seg >= 0),
    granja_id               BIGINT REFERENCES granja(id),        -- NULL = regla global
    activo                  BOOLEAN NOT NULL DEFAULT true,
    reemplaza_a             BIGINT REFERENCES regla_alerta(id),  -- versión anterior de esta regla
    created_by              BIGINT NOT NULL REFERENCES usuario(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    desactivada_at          TIMESTAMPTZ,

    CHECK (NOT isempty(rango_edad) AND lower_inc(rango_edad) AND lower(rango_edad) >= 0),
    CHECK (umbral_min_warning IS NOT NULL OR umbral_max_warning IS NOT NULL),
    -- Un crítico de un lado requiere el warning de ese lado, y va por fuera de él.
    CHECK (umbral_min_critico IS NULL OR (umbral_min_warning IS NOT NULL AND umbral_min_critico < umbral_min_warning)),
    CHECK (umbral_max_critico IS NULL OR (umbral_max_warning IS NOT NULL AND umbral_max_critico > umbral_max_warning)),
    CHECK (umbral_min_warning IS NULL OR umbral_max_warning IS NULL OR umbral_min_warning < umbral_max_warning),
    CHECK (activo = (desactivada_at IS NULL))
);

-- Sin rangos de edad superpuestos entre reglas activas de la misma métrica y el mismo alcance
-- (misma granja, o ambas globales). Un override de granja SÍ puede superponerse con la global.
ALTER TABLE regla_alerta ADD CONSTRAINT no_solapamiento_edad
    EXCLUDE USING gist (
        metrica                 WITH =,
        (COALESCE(granja_id, -1)) WITH =,
        rango_edad              WITH &&
    ) WHERE (activo);

-- Las alertas apuntan a la regla que las disparó: cambiar umbrales en el lugar rompería la
-- auditoría. Solo se permite desactivar (activo true → false).
CREATE FUNCTION regla_alerta_inmutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Las reglas de alerta no se borran: se desactivan.' USING ERRCODE = 'CN409';
    END IF;
    IF (NEW.metrica, NEW.rango_edad, NEW.umbral_min_warning, NEW.umbral_max_warning, NEW.umbral_min_critico,
        NEW.umbral_max_critico, NEW.histeresis, NEW.tiempo_persistencia_seg, NEW.granja_id, NEW.reemplaza_a, NEW.created_by)
       IS DISTINCT FROM
       (OLD.metrica, OLD.rango_edad, OLD.umbral_min_warning, OLD.umbral_max_warning, OLD.umbral_min_critico,
        OLD.umbral_max_critico, OLD.histeresis, OLD.tiempo_persistencia_seg, OLD.granja_id, OLD.reemplaza_a, OLD.created_by)
       OR (NOT OLD.activo AND NEW.activo) THEN
        RAISE EXCEPTION 'Las reglas de alerta no se editan: se crea una nueva versión (reemplaza_a) y se desactiva la anterior.'
            USING ERRCODE = 'CN409';
    END IF;
    IF OLD.activo AND NOT NEW.activo THEN
        NEW.desactivada_at := COALESCE(NEW.desactivada_at, now());
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER trg_regla_alerta_inmutable BEFORE UPDATE OR DELETE ON regla_alerta
    FOR EACH ROW EXECUTE FUNCTION regla_alerta_inmutable();

-- Reemplazo atómico de una regla: desactiva la vieja e inserta la nueva en la misma transacción.
CREATE FUNCTION reemplazar_regla(
    p_regla_id BIGINT,
    p_min_warning NUMERIC, p_max_warning NUMERIC, p_min_critico NUMERIC, p_max_critico NUMERIC,
    p_histeresis NUMERIC, p_tiempo_persistencia_seg INTEGER
) RETURNS regla_alerta
LANGUAGE plpgsql AS $$
DECLARE
    v_vieja regla_alerta;
    v_nueva regla_alerta;
BEGIN
    SELECT * INTO v_vieja FROM regla_alerta WHERE id = p_regla_id AND activo FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'La regla % no existe o no está activa.', p_regla_id USING ERRCODE = 'CN409';
    END IF;
    UPDATE regla_alerta SET activo = false WHERE id = p_regla_id;
    INSERT INTO regla_alerta (metrica, rango_edad, umbral_min_warning, umbral_max_warning, umbral_min_critico,
                              umbral_max_critico, histeresis, tiempo_persistencia_seg, granja_id, reemplaza_a, created_by)
    VALUES (v_vieja.metrica, v_vieja.rango_edad, p_min_warning, p_max_warning, p_min_critico, p_max_critico,
            p_histeresis, p_tiempo_persistencia_seg, v_vieja.granja_id, v_vieja.id,
            COALESCE(usuario_actual(), v_vieja.created_by))
    RETURNING * INTO v_nueva;
    RETURN v_nueva;
END $$;

-- Regla aplicable a un galpón: métrica + edad, restringida a SU granja o globales;
-- el override de la granja gana sobre la global.
CREATE FUNCTION regla_vigente(p_granja_id BIGINT, p_metrica metrica, p_edad INTEGER) RETURNS regla_alerta
LANGUAGE sql STABLE AS $$
    SELECT *
      FROM regla_alerta
     WHERE metrica = p_metrica
       AND activo
       AND rango_edad @> p_edad
       AND (granja_id = p_granja_id OR granja_id IS NULL)
     ORDER BY granja_id NULLS LAST
     LIMIT 1
$$;

-- Cobertura de las reglas GLOBALES: cada métrica tiene que cubrir todas las edades [0, ∞).
-- La API de administración no deja desactivar una regla si esta vista queda con completa = false.
CREATE VIEW v_cobertura_reglas AS
SELECT m.metrica,
       COALESCE(range_agg(r.rango_edad), '{}'::int4multirange) AS cubierto,
       COALESCE(range_agg(r.rango_edad), '{}'::int4multirange) = '{[0,)}'::int4multirange AS completa
  FROM (VALUES ('temperatura'), ('humedad'), ('co2'), ('amoniaco')) AS m(metrica)
  LEFT JOIN regla_alerta r ON r.metrica = m.metrica AND r.activo AND r.granja_id IS NULL
 GROUP BY m.metrica;

-- -----------------------------------------------------------------------------
-- Alertas
-- -----------------------------------------------------------------------------
-- El estado y la severidad NO se escriben: se derivan de las fechas. Así:
--   * no puede haber una alerta "resuelta" sin fecha de resolución (ni al revés);
--   * sincronizar con el Pi es una unión de fechas (COALESCE), sin conflictos;
--   * el historial sale solo, de las fechas que se van completando.
-- Precedencia del estado: resuelta > reconocida > escalada > activa.

CREATE TABLE alerta (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),  -- lo genera quien crea la alerta (Pi o nube)
    tipo                  TEXT NOT NULL CHECK (tipo IN ('ambiental', 'nodo_caido', 'dato_retrasado')),
    galpon_id             BIGINT NOT NULL REFERENCES galpon(id),
    nodo_id               BIGINT REFERENCES nodo(id),
    lote_id               BIGINT REFERENCES lote(id),          -- snapshot del lote activo al disparar
    regla_alerta_id       BIGINT REFERENCES regla_alerta(id),
    metrica               metrica,
    valor_leido           NUMERIC,

    fecha_disparo         TIMESTAMPTZ NOT NULL DEFAULT now(),
    fecha_critica         TIMESTAMPTZ,   -- cuándo pasó a crítica (= fecha_disparo si nació crítica)
    fecha_escalada        TIMESTAMPTZ,
    fecha_reconocimiento  TIMESTAMPTZ,
    fecha_resolucion      TIMESTAMPTZ,

    reconocida_por        BIGINT REFERENCES usuario(id),
    resuelta_por          BIGINT REFERENCES usuario(id),        -- NULL si fue automática
    resolucion_automatica BOOLEAN NOT NULL DEFAULT false,

    severidad             TEXT GENERATED ALWAYS AS (
                              CASE WHEN fecha_critica IS NOT NULL THEN 'critica' ELSE 'warning' END
                          ) STORED,
    estado                TEXT GENERATED ALWAYS AS (
                              CASE WHEN fecha_resolucion     IS NOT NULL THEN 'resuelta'
                                   WHEN fecha_reconocimiento IS NOT NULL THEN 'reconocida'
                                   WHEN fecha_escalada       IS NOT NULL THEN 'escalada'
                                   ELSE 'activa' END
                          ) STORED,

    origen                TEXT NOT NULL DEFAULT 'nube' CHECK (origen IN ('gateway', 'nube')),
    gateway_id            BIGINT REFERENCES gateway(id),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Qué datos lleva cada tipo.
    CHECK (
        (tipo = 'ambiental'      AND metrica IS NOT NULL AND regla_alerta_id IS NOT NULL AND valor_leido IS NOT NULL
                                 AND lote_id IS NOT NULL)
     OR (tipo = 'dato_retrasado' AND metrica IS NOT NULL AND regla_alerta_id IS NULL     AND valor_leido IS NULL)
     OR (tipo = 'nodo_caido'     AND metrica IS NULL     AND regla_alerta_id IS NULL     AND valor_leido IS NULL
                                 AND nodo_id IS NOT NULL)
    ),
    -- Las fechas no pueden ser anteriores al disparo.
    CHECK (fecha_critica        IS NULL OR fecha_critica        >= fecha_disparo),
    CHECK (fecha_escalada       IS NULL OR fecha_escalada       >= fecha_disparo),
    CHECK (fecha_reconocimiento IS NULL OR fecha_reconocimiento >= fecha_disparo),
    CHECK (fecha_resolucion     IS NULL OR fecha_resolucion     >= fecha_disparo),
    -- Reconocer siempre lo hace una persona.
    CHECK ((fecha_reconocimiento IS NULL) = (reconocida_por IS NULL)),
    -- Resolución: o la hizo una persona o fue automática, nunca las dos ni ninguna.
    CHECK (
        (fecha_resolucion IS NULL AND resuelta_por IS NULL AND NOT resolucion_automatica)
     OR (fecha_resolucion IS NOT NULL AND ((resuelta_por IS NULL) = resolucion_automatica))
    ),
    CHECK (origen = 'nube' OR gateway_id IS NOT NULL)
);

-- Sin duplicados: una sola alerta viva por galpón + tipo + métrica.
CREATE UNIQUE INDEX uq_alerta_viva ON alerta (galpon_id, tipo, (COALESCE(metrica::text, '-')))
    WHERE fecha_resolucion IS NULL;
CREATE INDEX ix_alerta_galpon_disparo ON alerta (galpon_id, fecha_disparo DESC);

-- Log de eventos de cada alerta. Lo escribe SOLO el trigger, a partir de las fechas.
CREATE TABLE alerta_historial (
    id         BIGSERIAL PRIMARY KEY,
    alerta_id  UUID NOT NULL REFERENCES alerta(id),
    evento     TEXT NOT NULL CHECK (evento IN ('disparada', 'critica', 'escalada', 'reconocida', 'resuelta')),
    usuario_id BIGINT REFERENCES usuario(id),  -- NULL = automático (motor, job, histéresis)
    ts         TIMESTAMPTZ NOT NULL,           -- cuándo pasó (no cuándo se sincronizó)
    UNIQUE (alerta_id, evento)
);

-- Una fecha, una vez puesta, no cambia; una alerta resuelta ya no cambia.
CREATE FUNCTION alerta_antes_actualizar() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.fecha_resolucion IS NOT NULL THEN
        RAISE EXCEPTION 'La alerta ya está resuelta.' USING ERRCODE = 'CN409';
    END IF;
    IF (OLD.fecha_critica        IS NOT NULL AND NEW.fecha_critica        IS DISTINCT FROM OLD.fecha_critica)
    OR (OLD.fecha_escalada       IS NOT NULL AND NEW.fecha_escalada       IS DISTINCT FROM OLD.fecha_escalada)
    OR (OLD.fecha_reconocimiento IS NOT NULL AND NEW.fecha_reconocimiento IS DISTINCT FROM OLD.fecha_reconocimiento)
    OR NEW.fecha_disparo <> OLD.fecha_disparo
    OR NEW.tipo <> OLD.tipo OR NEW.galpon_id <> OLD.galpon_id
    OR NEW.metrica IS DISTINCT FROM OLD.metrica THEN
        RAISE EXCEPTION 'Transición de alerta no permitida.' USING ERRCODE = 'CN409';
    END IF;
    NEW.updated_at := now();
    RETURN NEW;
END $$;

-- Deriva el historial de las fechas que se completaron en este INSERT/UPDATE.
-- Si una sincronización trae varios pasos juntos (ej. escalada + reconocida hechas offline),
-- quedan los dos eventos, cada uno con su hora real.
CREATE FUNCTION alerta_registrar_historial() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO alerta_historial (alerta_id, evento, ts) VALUES (NEW.id, 'disparada', NEW.fecha_disparo);
    END IF;
    IF NEW.fecha_critica IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.fecha_critica IS NULL) THEN
        INSERT INTO alerta_historial (alerta_id, evento, ts) VALUES (NEW.id, 'critica', NEW.fecha_critica);
    END IF;
    IF NEW.fecha_escalada IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.fecha_escalada IS NULL) THEN
        INSERT INTO alerta_historial (alerta_id, evento, ts) VALUES (NEW.id, 'escalada', NEW.fecha_escalada);
    END IF;
    IF NEW.fecha_reconocimiento IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.fecha_reconocimiento IS NULL) THEN
        INSERT INTO alerta_historial (alerta_id, evento, usuario_id, ts)
        VALUES (NEW.id, 'reconocida', NEW.reconocida_por, NEW.fecha_reconocimiento);
    END IF;
    IF NEW.fecha_resolucion IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.fecha_resolucion IS NULL) THEN
        INSERT INTO alerta_historial (alerta_id, evento, usuario_id, ts)
        VALUES (NEW.id, 'resuelta', NEW.resuelta_por, NEW.fecha_resolucion);
    END IF;
    RETURN NULL;
END $$;

CREATE TRIGGER trg_alerta_antes_actualizar BEFORE UPDATE ON alerta
    FOR EACH ROW EXECUTE FUNCTION alerta_antes_actualizar();
CREATE TRIGGER trg_alerta_registrar_historial AFTER INSERT OR UPDATE ON alerta
    FOR EACH ROW EXECUTE FUNCTION alerta_registrar_historial();

-- Sincronización desde el Pi: upsert por UUID + unión de fechas (lo primero que pasó gana).
-- Idempotente: reenviar la misma alerta no cambia nada. Ver docs/06-sincronizacion.md.
CREATE FUNCTION sincronizar_alerta(p alerta) RETURNS alerta
LANGUAGE plpgsql AS $$
DECLARE
    v alerta;
BEGIN
    INSERT INTO alerta AS a (id, tipo, galpon_id, nodo_id, lote_id, regla_alerta_id, metrica, valor_leido,
                             fecha_disparo, fecha_critica, fecha_escalada, fecha_reconocimiento, fecha_resolucion,
                             reconocida_por, resuelta_por, resolucion_automatica, origen, gateway_id)
    VALUES (p.id, p.tipo, p.galpon_id, p.nodo_id, p.lote_id, p.regla_alerta_id, p.metrica, p.valor_leido,
            p.fecha_disparo, p.fecha_critica, p.fecha_escalada, p.fecha_reconocimiento, p.fecha_resolucion,
            p.reconocida_por, p.resuelta_por, p.resolucion_automatica, 'gateway', p.gateway_id)
    ON CONFLICT (id) DO UPDATE SET
        fecha_critica         = COALESCE(a.fecha_critica, EXCLUDED.fecha_critica),
        fecha_escalada        = COALESCE(a.fecha_escalada, EXCLUDED.fecha_escalada),
        fecha_reconocimiento  = COALESCE(a.fecha_reconocimiento, EXCLUDED.fecha_reconocimiento),
        reconocida_por        = CASE WHEN a.fecha_reconocimiento IS NULL THEN EXCLUDED.reconocida_por ELSE a.reconocida_por END,
        fecha_resolucion      = COALESCE(a.fecha_resolucion, EXCLUDED.fecha_resolucion),
        resuelta_por          = CASE WHEN a.fecha_resolucion IS NULL THEN EXCLUDED.resuelta_por ELSE a.resuelta_por END,
        resolucion_automatica = CASE WHEN a.fecha_resolucion IS NULL THEN EXCLUDED.resolucion_automatica ELSE a.resolucion_automatica END,
        valor_leido           = CASE WHEN EXCLUDED.fecha_critica IS NOT NULL AND a.fecha_critica IS NULL
                                     THEN EXCLUDED.valor_leido ELSE a.valor_leido END
    -- Una alerta ya resuelta en la nube no se toca (evita el error del trigger en reenvíos).
    WHERE a.fecha_resolucion IS NULL
    RETURNING * INTO v;

    IF v.id IS NULL THEN
        SELECT * INTO v FROM alerta WHERE id = p.id;
    END IF;
    RETURN v;
END $$;

-- -----------------------------------------------------------------------------
-- Notificaciones (SMS, Telegram, push) — log y garantía de "una sola vez"
-- -----------------------------------------------------------------------------
-- Destinatarios (ver 05-decisiones.md):
--   motivo 'critica'  → encargados asignados al galpón: SMS (sale del Pi por GSM) + Telegram + push
--   motivo 'escalada' → encargados asignados + todos los admin: Telegram + push (sin SMS)

CREATE TABLE notificacion (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),  -- lo genera quien envía (Pi o nube)
    alerta_id   UUID NOT NULL REFERENCES alerta(id),
    usuario_id  BIGINT NOT NULL REFERENCES usuario(id),
    canal       TEXT NOT NULL CHECK (canal IN ('sms', 'telegram', 'push')),
    motivo      TEXT NOT NULL CHECK (motivo IN ('critica', 'escalada')),
    destino     TEXT NOT NULL,       -- teléfono, chat_id o token al momento del envío
    estado      TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'enviada', 'fallida')),
    intentos    INTEGER NOT NULL DEFAULT 0 CHECK (intentos >= 0),
    error       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    enviada_at  TIMESTAMPTZ,

    CHECK ((estado = 'enviada') = (enviada_at IS NOT NULL)),
    -- Cada persona recibe cada aviso por cada canal una sola vez.
    UNIQUE (alerta_id, usuario_id, canal, motivo)
);

-- Solo se notifica por SMS una alerta crítica.
CREATE FUNCTION notificacion_validar() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.canal = 'sms' AND NOT EXISTS (SELECT 1 FROM alerta WHERE id = NEW.alerta_id AND fecha_critica IS NOT NULL) THEN
        RAISE EXCEPTION 'Solo las alertas críticas se notifican por SMS.' USING ERRCODE = 'CN409';
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER trg_notificacion_validar BEFORE INSERT ON notificacion
    FOR EACH ROW EXECUTE FUNCTION notificacion_validar();

-- -----------------------------------------------------------------------------
-- Lecturas (hypertable) y agregado horario
-- -----------------------------------------------------------------------------

CREATE TABLE lectura (
    ts        TIMESTAMPTZ NOT NULL,
    galpon_id BIGINT NOT NULL REFERENCES galpon(id),
    lote_id   BIGINT REFERENCES lote(id),   -- snapshot del lote activo al momento de la lectura
    metrica   metrica NOT NULL,
    valor     NUMERIC NOT NULL,
    origen    TEXT NOT NULL DEFAULT 'realtime' CHECK (origen IN ('realtime', 'buffered')),  -- 'buffered' no pasa por el motor
    PRIMARY KEY (galpon_id, metrica, ts)     -- reenviar una lectura es idempotente (ON CONFLICT DO NOTHING)
);

SELECT create_hypertable('lectura', by_range('ts', INTERVAL '1 day'));

-- Compresión: después de 16 días, para que los datos atrasados del buffer del Pi (hasta 15 días)
-- caigan siempre en chunks sin comprimir.
ALTER TABLE lectura SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'galpon_id, metrica',
    timescaledb.compress_orderby   = 'ts DESC'
);
SELECT add_compression_policy('lectura', compress_after => INTERVAL '16 days');

-- Agregado por hora para los gráficos de 7 días y de lote completo.
-- materialized_only = false: la última hora (todavía sin materializar) se completa en vivo.
CREATE MATERIALIZED VIEW lectura_1h
WITH (timescaledb.continuous, timescaledb.materialized_only = false) AS
SELECT galpon_id,
       metrica,
       time_bucket(INTERVAL '1 hour', ts) AS bucket,
       avg(valor)  AS valor_prom,
       min(valor)  AS valor_min,
       max(valor)  AS valor_max,
       count(*)    AS cantidad_lecturas
  FROM lectura
 GROUP BY galpon_id, metrica, bucket
WITH NO DATA;

-- La política refresca las últimas horas. Los datos atrasados que sube el Pi al reconectar
-- caen fuera de esa ventana: la ingesta llama a
--   CALL refresh_continuous_aggregate('lectura_1h', <ts mínimo del lote>, <ts máximo>);
-- después de insertarlos (ver docs/06-sincronizacion.md).
SELECT add_continuous_aggregate_policy('lectura_1h',
    start_offset      => INTERVAL '3 hours',
    end_offset        => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour');

-- Retención de lectura cruda: pendiente (decisión abierta). Cuando se defina:
--   SELECT add_retention_policy('lectura', drop_after => INTERVAL '<n> days');
