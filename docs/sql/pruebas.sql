-- =============================================================================
-- Pruebas del esquema. Correr sobre una base recién creada con 001 + 002:
--   psql -v ON_ERROR_STOP=1 -d carnave_test -f pruebas.sql
-- Todo corre en una transacción que se revierte al final: no deja datos.
-- Si algo falla, psql corta con el mensaje de la prueba que no pasó.
-- =============================================================================

BEGIN;

-- Ejecuta p_sql y exige que falle con p_sqlstate (y, si se da, que el mensaje contenga p_texto).
CREATE FUNCTION pg_temp.espera_error(p_sql TEXT, p_sqlstate TEXT, p_texto TEXT DEFAULT NULL) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
    BEGIN
        EXECUTE p_sql;
    EXCEPTION WHEN OTHERS THEN
        IF SQLSTATE <> p_sqlstate OR (p_texto IS NOT NULL AND position(p_texto IN SQLERRM) = 0) THEN
            RAISE EXCEPTION 'FALLÓ: [%] esperaba % (%), obtuvo %: %', p_sql, p_sqlstate, p_texto, SQLSTATE, SQLERRM;
        END IF;
        RETURN;
    END;
    RAISE EXCEPTION 'FALLÓ: [%] debía fallar con % y no falló', p_sql, p_sqlstate;
END $$;

CREATE FUNCTION pg_temp.afirmar(p_ok BOOLEAN, p_que TEXT) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
    IF p_ok IS NOT TRUE THEN RAISE EXCEPTION 'FALLÓ: %', p_que; END IF;
END $$;

-- Datos de prueba ------------------------------------------------------------
INSERT INTO usuario (id, nombre, email, password_hash, rol, telefono)
VALUES (2, 'Esteban Martínez', 'encargado@carnave.com', 'x', 'encargado', '+5493496000000');
INSERT INTO granja (id, nombre) VALUES (2, 'Granja Norte');
INSERT INTO galpon (id, granja_id, nombre) VALUES (2, 1, 'Galpón 2'), (3, 2, 'Galpón Norte');
INSERT INTO gateway (id, granja_id, identificador, token_hash) VALUES (1, 1, 'pi-esperanza', 'h');
INSERT INTO nodo (id, galpon_id, identificador) VALUES (1, 1, 'AA:BB:CC:00:00:01');
SET LOCAL carnave.usuario_id = '2';

-- #11 email sin distinguir mayúsculas ----------------------------------------
SELECT pg_temp.espera_error($$INSERT INTO usuario (nombre, email, password_hash, rol) VALUES ('X', 'ENCARGADO@Carnave.com', 'x', 'encargado')$$, '23505');
SELECT pg_temp.afirmar((SELECT id FROM usuario WHERE email = 'Encargado@CARNAVE.com') = 2, 'login por email con otra capitalización');
SELECT pg_temp.espera_error($$UPDATE usuario SET telefono = '3496000000' WHERE id = 2$$, '23514');  -- #6 teléfono E.164

-- #1 un solo nodo activo por galpón -------------------------------------------
SELECT pg_temp.espera_error($$INSERT INTO nodo (galpon_id, identificador) VALUES (1, 'AA:BB:CC:00:00:02')$$, '23505');
UPDATE nodo SET ultima_conexion = now() - INTERVAL '1 minute' WHERE id = 1;
SELECT pg_temp.afirmar(estado_nodo(now() - INTERVAL '1 minute')  = 'online',    'nodo online < 5 min');
SELECT pg_temp.afirmar(estado_nodo(now() - INTERVAL '10 minutes') = 'retrasado', 'nodo retrasado < 15 min');
SELECT pg_temp.afirmar(estado_nodo(now() - INTERVAL '20 minutes') = 'caido',     'nodo caído ≥ 15 min');
SELECT pg_temp.afirmar(estado_nodo(NULL) = 'caido', 'nodo que nunca reportó');

-- #8 #9 ciclo de vida del lote y del galpón ----------------------------------
SELECT pg_temp.espera_error(format($$INSERT INTO lote (galpon_id, fecha_inicio, fecha_fin_estimada, cantidad_aves_inicial, created_by) VALUES (1, %L, %L, 100, 2)$$, hoy_ar() + 1, hoy_ar() + 46), 'CN400', 'futura');
SELECT pg_temp.espera_error($$INSERT INTO lote (galpon_id, fecha_inicio, fecha_fin_estimada, cantidad_aves_inicial, created_by, estado) VALUES (1, '2026-09-01', '2026-10-15', 100, 2, 'finalizado')$$, 'CN400');
SELECT pg_temp.espera_error($$UPDATE galpon SET estado_operativo = 'produccion' WHERE id = 1$$, 'CN409');  -- sin lote no hay producción

INSERT INTO lote (id, galpon_id, numero, fecha_inicio, fecha_fin_estimada, cantidad_aves_inicial)
VALUES (100, 1, '13', hoy_ar() - 18, hoy_ar() + 27, 12400);  -- created_by sale de carnave.usuario_id
SELECT pg_temp.afirmar((SELECT estado_operativo FROM galpon WHERE id = 1) = 'produccion', 'crear lote → producción');
SELECT pg_temp.afirmar((SELECT created_by FROM lote WHERE id = 100) = 2, 'created_by desde la sesión');
SELECT pg_temp.afirmar(edad_dias(100) = 18, 'edad_dias');
SELECT pg_temp.espera_error($$INSERT INTO lote (galpon_id, fecha_inicio, fecha_fin_estimada, cantidad_aves_inicial, created_by) VALUES (1, '2026-09-01', '2026-10-15', 100, 2)$$, 'CN409');
SELECT pg_temp.espera_error($$UPDATE galpon SET estado_operativo = 'limpieza', fecha_inicio_limpieza = '2026-09-01' WHERE id = 1$$, 'CN409');  -- con lote activo no
SELECT pg_temp.espera_error($$INSERT INTO lote (galpon_id, numero, fecha_inicio, fecha_fin_estimada, cantidad_aves_inicial, created_by) VALUES (2, '123456789012345678901', '2026-09-01', '2026-10-15', 1, 2)$$, '23514');  -- #10 numero ≤ 20

-- #7 edad en hora argentina aunque la sesión esté en UTC
SET LOCAL timezone = 'UTC';
SELECT pg_temp.afirmar(hoy_ar() = (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date, 'hoy_ar independiente de la sesión');
SELECT pg_temp.afirmar(edad_dias(100) = 18, 'edad_dias no cambia con la zona de la sesión');
SET LOCAL timezone = 'America/Argentina/Buenos_Aires';

-- #2 #12 alertas por tipo, estado derivado e historial ------------------------
INSERT INTO alerta (id, tipo, galpon_id, lote_id, regla_alerta_id, metrica, valor_leido, fecha_disparo)
VALUES ('00000000-0000-0000-0000-000000000001', 'ambiental', 1, 100, 5, 'co2', 2850, now() - INTERVAL '40 minutes');
SELECT pg_temp.afirmar((SELECT (estado, severidad) = ('activa', 'warning') FROM alerta WHERE id = '00000000-0000-0000-0000-000000000001'), 'nace activa/warning');
SELECT pg_temp.espera_error($$INSERT INTO alerta (tipo, galpon_id, lote_id, regla_alerta_id, metrica, valor_leido) VALUES ('ambiental', 1, 100, 5, 'co2', 2900)$$, '23505');  -- duplicado vivo
SELECT pg_temp.espera_error($$INSERT INTO alerta (tipo, galpon_id, metrica) VALUES ('ambiental', 1, 'humedad')$$, '23514');  -- ambiental sin regla/valor
SELECT pg_temp.espera_error($$INSERT INTO alerta (tipo, galpon_id, metrica) VALUES ('nodo_caido', 1, 'co2')$$, '23514');     -- nodo_caido no lleva métrica
SELECT pg_temp.espera_error($$INSERT INTO alerta (tipo, galpon_id, metrica) VALUES ('ambiental', 1, 'ozono')$$, '23514');    -- #10 métrica inválida

-- Otros tipos conviven con la ambiental del mismo galpón (y funcionan fuera de producción).
INSERT INTO alerta (id, tipo, galpon_id, nodo_id, fecha_disparo, fecha_critica)
VALUES ('00000000-0000-0000-0000-000000000002', 'nodo_caido', 1, 1, now() - INTERVAL '5 minutes', now() - INTERVAL '5 minutes');
INSERT INTO alerta (tipo, galpon_id, metrica) VALUES ('dato_retrasado', 1, 'co2');
INSERT INTO alerta (tipo, galpon_id, metrica) VALUES ('dato_retrasado', 2, 'humedad');  -- galpón 2 está disponible
SELECT pg_temp.afirmar((SELECT severidad FROM alerta WHERE id = '00000000-0000-0000-0000-000000000002') = 'critica', 'nodo_caido nace crítica');

-- Escalada, suba a crítica y reconocimiento.
UPDATE alerta SET fecha_escalada = now() - INTERVAL '10 minutes' WHERE id = '00000000-0000-0000-0000-000000000001';
UPDATE alerta SET fecha_critica  = now() - INTERVAL '5 minutes', valor_leido = 3100 WHERE id = '00000000-0000-0000-0000-000000000001';
SELECT pg_temp.espera_error($$UPDATE alerta SET fecha_critica = NULL WHERE id = '00000000-0000-0000-0000-000000000001'$$, 'CN409');  -- no baja de crítica
SELECT pg_temp.espera_error($$UPDATE alerta SET fecha_reconocimiento = now() WHERE id = '00000000-0000-0000-0000-000000000001'$$, '23514');  -- falta quién
UPDATE alerta SET fecha_reconocimiento = now(), reconocida_por = 2 WHERE id = '00000000-0000-0000-0000-000000000001';
SELECT pg_temp.afirmar((SELECT (estado, severidad) = ('reconocida', 'critica') FROM alerta WHERE id = '00000000-0000-0000-0000-000000000001'), 'reconocida/crítica');
SELECT pg_temp.espera_error($$UPDATE alerta SET fecha_resolucion = now() WHERE id = '00000000-0000-0000-0000-000000000001'$$, '23514');  -- ni persona ni automática
UPDATE alerta SET fecha_resolucion = now(), resuelta_por = 2 WHERE id = '00000000-0000-0000-0000-000000000001';
SELECT pg_temp.espera_error($$UPDATE alerta SET valor_leido = 1 WHERE id = '00000000-0000-0000-0000-000000000001'$$, 'CN409');  -- resuelta es terminal
SELECT pg_temp.afirmar(
    (SELECT array_agg(evento ORDER BY ts, id) FROM alerta_historial WHERE alerta_id = '00000000-0000-0000-0000-000000000001')
    = ARRAY['disparada', 'escalada', 'critica', 'reconocida', 'resuelta'],
    'historial completo y en orden');
SELECT pg_temp.afirmar((SELECT usuario_id FROM alerta_historial WHERE alerta_id = '00000000-0000-0000-0000-000000000001' AND evento = 'reconocida') = 2, 'historial registra quién');

-- Una vez resuelta, se puede abrir una nueva para el mismo galpón + métrica.
INSERT INTO alerta (tipo, galpon_id, lote_id, regla_alerta_id, metrica, valor_leido) VALUES ('ambiental', 1, 100, 5, 'co2', 2600);

-- #3 sincronización desde el Pi (UUID del origen, unión de fechas, idempotente) --------
-- La nube reconoció la alerta de nodo caído mientras el Pi, sin internet, la resolvía sola.
UPDATE alerta SET fecha_reconocimiento = now() - INTERVAL '3 minutes', reconocida_por = 2 WHERE id = '00000000-0000-0000-0000-000000000002';
SELECT sincronizar_alerta(ROW('00000000-0000-0000-0000-000000000002', 'nodo_caido', 1, 1, NULL, NULL, NULL, NULL,
    now() - INTERVAL '5 minutes', now() - INTERVAL '5 minutes', NULL, NULL, now() - INTERVAL '1 minute',
    NULL, NULL, true, NULL, NULL, 'gateway', 1, now())::alerta);
SELECT pg_temp.afirmar((SELECT (estado, reconocida_por, resolucion_automatica) = ('resuelta', 2::bigint, true)
                          FROM alerta WHERE id = '00000000-0000-0000-0000-000000000002'), 'merge: conserva el reconocimiento de la nube y la resolución del Pi');
-- Reenvío idempotente (el Pi no recibió el ACK y manda lo mismo).
SELECT sincronizar_alerta(ROW('00000000-0000-0000-0000-000000000002', 'nodo_caido', 1, 1, NULL, NULL, NULL, NULL,
    now() - INTERVAL '5 minutes', now() - INTERVAL '5 minutes', NULL, NULL, now() - INTERVAL '1 minute',
    NULL, NULL, true, NULL, NULL, 'gateway', 1, now())::alerta);
SELECT pg_temp.afirmar((SELECT count(*) FROM alerta_historial WHERE alerta_id = '00000000-0000-0000-0000-000000000002') = 4, 'reenvío no duplica historial');
-- Alerta creada offline en el Pi, con escalada y reconocimiento local: llega todo junto.
SELECT sincronizar_alerta(ROW('00000000-0000-0000-0000-0000000000a1', 'ambiental', 1, NULL, 100, 1, 'temperatura', 29,
    now() - INTERVAL '2 hours', NULL, now() - INTERVAL '90 minutes', now() - INTERVAL '80 minutes', NULL,
    2, NULL, false, NULL, NULL, 'gateway', 1, now())::alerta);
SELECT pg_temp.afirmar(
    (SELECT array_agg(evento ORDER BY ts) FROM alerta_historial WHERE alerta_id = '00000000-0000-0000-0000-0000000000a1')
    = ARRAY['disparada', 'escalada', 'reconocida'], 'alerta offline trae su historial con horas reales');

-- #6 notificaciones: una por persona/canal/motivo; SMS solo si es crítica -------------
INSERT INTO notificacion (alerta_id, usuario_id, canal, motivo, destino)
VALUES ('00000000-0000-0000-0000-000000000002', 2, 'sms', 'critica', '+5493496000000');
SELECT pg_temp.espera_error($$INSERT INTO notificacion (alerta_id, usuario_id, canal, motivo, destino) VALUES ('00000000-0000-0000-0000-000000000002', 2, 'sms', 'critica', '+5493496000000')$$, '23505');
SELECT pg_temp.espera_error($$INSERT INTO notificacion (alerta_id, usuario_id, canal, motivo, destino) VALUES ('00000000-0000-0000-0000-0000000000a1', 2, 'sms', 'critica', '+5493496000000')$$, 'CN409');

-- #9 #16 finalizar lote → limpieza con fechas; limpieza → disponible manual; auditoría --
SELECT pg_temp.espera_error($$UPDATE galpon SET estado_operativo = 'disponible' WHERE id = 1$$, 'CN409');  -- producción → disponible no
UPDATE lote SET estado = 'finalizado' WHERE id = 100;
SELECT pg_temp.afirmar((SELECT (fecha_fin_real, finalizado_por) = (hoy_ar(), 2::bigint) FROM lote WHERE id = 100), 'fecha_fin_real y finalizado_por');
SELECT pg_temp.afirmar((SELECT (estado_operativo, fecha_inicio_limpieza, fecha_fin_limpieza_estimada) = ('limpieza', hoy_ar(), hoy_ar() + 15)
                          FROM galpon WHERE id = 1), 'finalizar → limpieza con fechas');
SELECT pg_temp.espera_error($$UPDATE lote SET notas = 'x' WHERE id = 100$$, 'CN409');  -- finalizado no se toca
SELECT pg_temp.espera_error($$UPDATE galpon SET estado_operativo = 'produccion' WHERE id = 1$$, 'CN409');
UPDATE galpon SET estado_operativo = 'disponible' WHERE id = 1;
SELECT pg_temp.afirmar((SELECT fecha_inicio_limpieza IS NULL AND fecha_fin_limpieza_estimada IS NULL FROM galpon WHERE id = 1), 'disponible limpia fechas');
SELECT pg_temp.afirmar(
    (SELECT array_agg(estado_anterior || '→' || estado_nuevo || ':' || COALESCE(usuario_id::text, 'auto') ORDER BY id) FROM galpon_estado_historial WHERE galpon_id = 1)
    = ARRAY['disponible→produccion:2', 'produccion→limpieza:2', 'limpieza→disponible:2'], 'historial del galpón con usuario');

-- #33 cargar un lote en un galpón en limpieza termina la limpieza automáticamente
INSERT INTO lote (id, galpon_id, fecha_inicio, fecha_fin_estimada, cantidad_aves_inicial) VALUES (101, 1, hoy_ar() - 1, hoy_ar() + 44, 100);
UPDATE lote SET estado = 'finalizado' WHERE id = 101;                                   -- galpón 1 → limpieza
SELECT pg_temp.afirmar((SELECT estado_operativo FROM galpon WHERE id = 1) = 'limpieza', 'de nuevo en limpieza');
INSERT INTO lote (id, galpon_id, fecha_inicio, fecha_fin_estimada, cantidad_aves_inicial) VALUES (102, 1, hoy_ar(), hoy_ar() + 45, 100);
SELECT pg_temp.afirmar((SELECT (estado_operativo, fecha_inicio_limpieza, fecha_fin_limpieza_estimada) IS NOT DISTINCT FROM ('produccion', NULL::date, NULL::date)
                          FROM galpon WHERE id = 1), 'lote desde limpieza → producción y limpia fechas');
SELECT pg_temp.afirmar((SELECT estado_anterior FROM galpon_estado_historial WHERE galpon_id = 1 ORDER BY id DESC LIMIT 1) = 'limpieza', 'historial registra limpieza→produccion');
SELECT pg_temp.espera_error($$INSERT INTO lote (galpon_id, fecha_inicio, fecha_fin_estimada, cantidad_aves_inicial, created_by) VALUES (1, '2026-09-01', '2026-10-15', 100, 2)$$, 'CN409', 'producción');  -- en producción, no

-- #4 #5 #13 #14 reglas -------------------------------------------------------
INSERT INTO regla_alerta (id, metrica, rango_edad, umbral_max_warning, umbral_max_critico, granja_id, created_by)
VALUES (900, 'co2', '[0,)', 3000, 4000, 2, 1);  -- override de la granja 2
SELECT pg_temp.afirmar((regla_vigente(2, 'co2', 18)).id = 900, 'override de la granja propia gana');
SELECT pg_temp.afirmar((regla_vigente(1, 'co2', 18)).id = 5,   'otra granja NO toma el override ajeno');
SELECT pg_temp.afirmar((regla_vigente(1, 'temperatura', 70)).id = 3, 'edad > 22 sigue teniendo regla (rango abierto)');
SELECT pg_temp.espera_error($$INSERT INTO regla_alerta (metrica, rango_edad, umbral_max_warning, created_by) VALUES ('co2', '[10,20)', 2000, 1)$$, '23P01');  -- solapa con la global
SELECT pg_temp.espera_error($$INSERT INTO regla_alerta (metrica, rango_edad, umbral_max_warning, umbral_max_critico, granja_id, created_by) VALUES ('humedad', '[0,)', 70, 60, 1, 1)$$, '23514');  -- crítico dentro del warning
SELECT pg_temp.espera_error($$UPDATE regla_alerta SET umbral_max_warning = 2600 WHERE id = 5$$, 'CN409');  -- inmutable
SELECT pg_temp.espera_error($$DELETE FROM regla_alerta WHERE id = 5$$, 'CN409');
SELECT pg_temp.afirmar((reemplazar_regla(5, NULL, 2600, NULL, 3000, 0.5, 60)).reemplaza_a = 5, 'reemplazo crea versión nueva');
SELECT pg_temp.afirmar((SELECT NOT activo AND desactivada_at IS NOT NULL FROM regla_alerta WHERE id = 5), 'la vieja queda desactivada');
SELECT pg_temp.afirmar((SELECT regla_alerta_id FROM alerta WHERE id = '00000000-0000-0000-0000-000000000001') = 5, 'la alerta vieja sigue apuntando a los umbrales que la dispararon');
SELECT pg_temp.afirmar((SELECT bool_and(completa) FROM v_cobertura_reglas), 'cobertura completa después del reemplazo');
UPDATE regla_alerta SET activo = false WHERE metrica = 'humedad' AND granja_id IS NULL;
SELECT pg_temp.afirmar(NOT (SELECT completa FROM v_cobertura_reglas WHERE metrica = 'humedad'), 'la vista detecta el hueco');

-- #7 lecturas: hypertable idempotente y agregado ------------------------------
INSERT INTO lectura (ts, galpon_id, metrica, valor) VALUES ('2026-09-28 10:00-03', 1, 'co2', 2000), ('2026-09-28 10:30-03', 1, 'co2', 2200);
INSERT INTO lectura (ts, galpon_id, metrica, valor) VALUES ('2026-09-28 10:00-03', 1, 'co2', 2000) ON CONFLICT DO NOTHING;
SELECT pg_temp.afirmar((SELECT count(*) FROM lectura) = 2, 'reenvío de lecturas idempotente');
SELECT pg_temp.afirmar((SELECT valor_prom FROM lectura_1h WHERE galpon_id = 1 AND metrica = 'co2') = 2100, 'lectura_1h en vivo (materialized_only = false)');

-- #35 altas y bajas de granjas y galpones (baja = desactivar) ------------------
INSERT INTO granja (id, nombre) VALUES (3, '  Granja Sur ');
SELECT pg_temp.afirmar((SELECT nombre FROM granja WHERE id = 3) = 'Granja Sur', 'nombre de granja sin espacios de borde');
SELECT pg_temp.espera_error($$INSERT INTO granja (nombre) VALUES ('granja sur')$$, '23505');  -- repetido sin mayúsculas
SELECT pg_temp.espera_error($$INSERT INTO granja (nombre) VALUES ('   ')$$, '23514');
SELECT pg_temp.espera_error($$INSERT INTO granja (nombre, activo) VALUES ('Otra', false)$$, 'CN400');
INSERT INTO galpon (id, granja_id, nombre) VALUES (30, 3, 'Galpón A'), (31, 3, 'Galpón B');
SELECT pg_temp.espera_error($$INSERT INTO galpon (granja_id, nombre) VALUES (3, ' galpón a ')$$, '23505');
SELECT pg_temp.espera_error($$INSERT INTO galpon (granja_id, nombre, estado_operativo) VALUES (3, 'Galpón C', 'limpieza')$$, 'CN400');
SELECT pg_temp.espera_error($$UPDATE galpon SET granja_id = 1 WHERE id = 30$$, 'CN400', 'no cambia de granja');
INSERT INTO nodo (id, galpon_id, identificador) VALUES (30, 30, 'AA:BB:CC:00:00:30'), (31, 31, 'AA:BB:CC:00:00:31');
INSERT INTO usuario_galpon VALUES (2, 30), (2, 31);
INSERT INTO lote (id, galpon_id, fecha_inicio, fecha_fin_estimada, cantidad_aves_inicial) VALUES (300, 30, hoy_ar() - 5, hoy_ar() + 40, 1000);
SELECT pg_temp.espera_error($$UPDATE galpon SET activo = false WHERE id = 30$$, 'CN409', 'producción');
SELECT pg_temp.espera_error($$UPDATE granja SET activo = false WHERE id = 3$$, 'CN409', 'galpones activos');

-- Baja de un galpón con alerta abierta: se desactiva el nodo, se quitan asignaciones y la alerta se resuelve sola.
INSERT INTO alerta (id, tipo, galpon_id, nodo_id) VALUES ('00000000-0000-0000-0000-000000000031', 'nodo_caido', 31, 31);
UPDATE galpon SET activo = false WHERE id = 31;
SELECT pg_temp.afirmar(NOT (SELECT activo FROM nodo WHERE id = 31), 'baja de galpón desactiva su nodo');
SELECT pg_temp.afirmar(NOT EXISTS (SELECT 1 FROM usuario_galpon WHERE galpon_id = 31), 'baja de galpón quita asignaciones');
SELECT pg_temp.afirmar((SELECT estado = 'resuelta' AND resolucion_automatica AND resuelta_por IS NULL
                          FROM alerta WHERE id = '00000000-0000-0000-0000-000000000031'), 'baja de galpón resuelve sus alertas abiertas');
SELECT pg_temp.afirmar(EXISTS (SELECT 1 FROM alerta_historial WHERE alerta_id = '00000000-0000-0000-0000-000000000031'
                                  AND evento = 'resuelta' AND usuario_id IS NULL), 'la resolución automática queda en el historial');
SELECT pg_temp.espera_error($$INSERT INTO usuario_galpon VALUES (2, 31)$$, 'CN400', 'dado de baja');
SELECT pg_temp.espera_error($$INSERT INTO lote (galpon_id, fecha_inicio, fecha_fin_estimada, cantidad_aves_inicial) VALUES (31, hoy_ar(), hoy_ar() + 45, 100)$$, 'CN409', 'dado de baja');

-- El nombre de un galpón dado de baja queda libre; reactivarlo con el nombre ocupado falla.
INSERT INTO galpon (id, granja_id, nombre) VALUES (32, 3, 'Galpón B');
SELECT pg_temp.espera_error($$UPDATE galpon SET activo = true WHERE id = 31$$, '23505');

-- Granja: se da de baja recién sin galpones activos; con la granja inactiva no hay altas ni reactivaciones.
UPDATE lote SET estado = 'finalizado' WHERE id = 300;
UPDATE galpon SET activo = false WHERE granja_id = 3 AND activo;
SELECT pg_temp.afirmar((SELECT estado_operativo FROM galpon WHERE id = 30) = 'limpieza', 'un galpón dado de baja en limpieza queda en limpieza');
UPDATE granja SET activo = false WHERE id = 3;
SELECT pg_temp.espera_error($$INSERT INTO galpon (granja_id, nombre) VALUES (3, 'Galpón D')$$, 'CN409', 'dada de baja');
SELECT pg_temp.espera_error($$UPDATE galpon SET activo = true WHERE id = 30$$, 'CN409', 'reactivala');
UPDATE granja SET activo = true WHERE id = 3;
UPDATE galpon SET activo = true WHERE id = 30;
SELECT pg_temp.afirmar((SELECT activo FROM galpon WHERE id = 30), 'reactivación de galpón con la granja activa');

SELECT 'OK: todas las pruebas del esquema pasaron' AS resultado;
ROLLBACK;
