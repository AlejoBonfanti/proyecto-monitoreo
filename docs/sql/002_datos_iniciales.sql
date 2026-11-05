-- =============================================================================
-- Carnave — datos iniciales del piloto (correr después de 001_esquema.sql)
--
-- ⚠ PROVISIONAL: los umbrales de regla_alerta son valores de ejemplo tomados del
--   mockup. Tienen que validarlos Grupo CEM / su veterinario antes del piloto
--   (decisión abierta en 05-decisiones.md). Se cargan igual para poder probar.
-- =============================================================================

-- Administrador inicial. La contraseña se define al instalar: reemplazar el hash
-- por uno real (argon2id) generado por la API, nunca dejar este valor.
INSERT INTO usuario (id, nombre, email, password_hash, rol)
VALUES (1, 'Administrador Carnave', 'admin@carnave.com', 'REEMPLAZAR_POR_HASH_ARGON2', 'admin');
SELECT setval('usuario_id_seq', (SELECT max(id) FROM usuario));

INSERT INTO granja (id, nombre, ubicacion) VALUES (1, 'Granja Esperanza', 'Esperanza, Santa Fe');
SELECT setval('granja_id_seq', (SELECT max(id) FROM granja));

INSERT INTO galpon (id, granja_id, nombre) VALUES (1, 1, 'Galpón 1');  -- nace 'disponible'
SELECT setval('galpon_id_seq', (SELECT max(id) FROM galpon));

-- Reglas GLOBALES por rango de edad (días). La última de cada métrica es abierta ('[n,)'),
-- así ninguna edad queda sin regla (v_cobertura_reglas.completa = true).
-- Criterio de umbral: el valor que ALCANZA el umbral ya dispara (≥ máximo, ≤ mínimo).
INSERT INTO regla_alerta (metrica, rango_edad, umbral_min_warning, umbral_max_warning, umbral_min_critico, umbral_max_critico, created_by) VALUES
    ('temperatura', '[0,8)',   30,   34,   28,   36,   1),
    ('temperatura', '[8,22)',  24,   28,   22,   31,   1),
    ('temperatura', '[22,)',   18,   25,   16,   29,   1),
    ('humedad',     '[0,)',    50,   70,   40,   80,   1),
    ('co2',         '[0,)',    NULL, 2500, NULL, 3000, 1),
    ('amoniaco',    '[0,)',    NULL, 10,   NULL, 15,   1);
