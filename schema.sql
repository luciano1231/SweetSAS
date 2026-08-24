CREATE TABLE IF NOT EXISTS rendiciones (
  id                  TEXT PRIMARY KEY,
  local_id            TEXT NOT NULL,
  local_nombre        TEXT,
  turno               TEXT NOT NULL,
  empleado_id         TEXT,
  empleado_nombre     TEXT,
  fecha               TEXT NOT NULL,

  billetes_10         INTEGER DEFAULT 0,
  billetes_20         INTEGER DEFAULT 0,
  billetes_50         INTEGER DEFAULT 0,
  billetes_100        INTEGER DEFAULT 0,
  billetes_200        INTEGER DEFAULT 0,
  billetes_500        INTEGER DEFAULT 0,
  billetes_1000       INTEGER DEFAULT 0,
  billetes_2000       INTEGER DEFAULT 0,
  billetes_10000      INTEGER DEFAULT 0,
  billetes_20000      INTEGER DEFAULT 0,
  total_efectivo      REAL DEFAULT 0,

  debito              REAL DEFAULT 0,
  credito             REAL DEFAULT 0,
  qr                  REAL DEFAULT 0,
  mp_point            REAL DEFAULT 0,
  pedidos_ya          REAL DEFAULT 0,
  transferencia       REAL DEFAULT 0,

  total_real          REAL DEFAULT 0,
  registrado_sistema  REAL DEFAULT 0,
  diferencia          REAL DEFAULT 0,
  observaciones       TEXT,

  created_at          TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rendiciones_local ON rendiciones(local_id);
CREATE INDEX IF NOT EXISTS idx_rendiciones_fecha ON rendiciones(fecha);

-- ============================================
-- CAJA CHICA (gastos e ingresos internos por local)
-- ============================================
-- Cada local carga movimientos sueltos (estado='pendiente') hasta que
-- cierra la caja y los "envía": ese envío exige saldo (ingreso-egreso) en
-- cero y pasa todas las filas pendientes a estado='enviado', agrupadas
-- por lote_envio, pasando a formar parte de la planilla maestra del local
-- (historial). Ver functions/api/caja-chica.js.
CREATE TABLE IF NOT EXISTS caja_chica_movimientos (
  id            TEXT PRIMARY KEY,
  local_id      TEXT NOT NULL,
  local_nombre  TEXT,
  fecha         TEXT NOT NULL,
  item          TEXT NOT NULL,
  clasificacion TEXT NOT NULL,
  detalle       TEXT,
  ingreso       REAL DEFAULT 0,
  egreso        REAL DEFAULT 0,
  estado        TEXT NOT NULL DEFAULT 'pendiente',
  lote_envio    TEXT,
  fecha_envio   TEXT,
  creado_por    TEXT,
  created_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cajachica_local ON caja_chica_movimientos(local_id);
CREATE INDEX IF NOT EXISTS idx_cajachica_estado ON caja_chica_movimientos(local_id, estado);
CREATE INDEX IF NOT EXISTS idx_cajachica_fecha ON caja_chica_movimientos(fecha);

-- ============================================
-- OBLIGACIONES (resúmenes bancarios / dinero digital)
-- Migrado del clasificador de Google Apps Script. Ver
-- functions/api/obligaciones*.js.
-- ============================================
CREATE TABLE IF NOT EXISTS obligaciones_movimientos (
  id                TEXT PRIMARY KEY,
  fecha             TEXT NOT NULL,
  obligacion        TEXT NOT NULL,
  de_quien_la_deuda TEXT,
  origen_del_dinero TEXT,
  monto             REAL DEFAULT 0,
  observacion       TEXT,
  banco             TEXT NOT NULL,
  archivo_origen    TEXT,
  archivo_id        TEXT,
  created_at        TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_obligaciones_fecha ON obligaciones_movimientos(fecha);
CREATE INDEX IF NOT EXISTS idx_obligaciones_obligacion ON obligaciones_movimientos(obligacion);
CREATE INDEX IF NOT EXISTS idx_obligaciones_banco ON obligaciones_movimientos(banco);
CREATE INDEX IF NOT EXISTS idx_obligaciones_archivo_id ON obligaciones_movimientos(archivo_id);

-- Reglas curadas a mano: "dato a buscar" (palabra clave) -> Obligación
CREATE TABLE IF NOT EXISTS obligaciones_referencias_banco (
  id           TEXT PRIMARY KEY,
  dato_buscar  TEXT NOT NULL UNIQUE,
  obligacion   TEXT NOT NULL
);

-- Clasificación general para resúmenes visuales: Obligación -> Clasificación
CREATE TABLE IF NOT EXISTS obligaciones_referencias_generales (
  id            TEXT PRIMARY KEY,
  obligacion    TEXT NOT NULL UNIQUE,
  clasificacion TEXT
);

-- Memoria de aprendizaje: observación exacta -> Obligación asignada a mano
CREATE TABLE IF NOT EXISTS obligaciones_aprendizaje (
  id          TEXT PRIMARY KEY,
  observacion TEXT NOT NULL UNIQUE,
  obligacion  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

-- Log de archivos ya procesados (evita duplicados si se sube el mismo resumen dos veces)
CREATE TABLE IF NOT EXISTS obligaciones_archivos (
  id               TEXT PRIMARY KEY,
  fingerprint      TEXT NOT NULL UNIQUE,
  nombre_archivo   TEXT,
  banco            TEXT,
  filas_insertadas INTEGER DEFAULT 0,
  created_at       TEXT NOT NULL
);

-- ============================================
-- RECETAS (costos de ingredientes, costos fijos y precios de productos)
-- Migrado de la planilla "Costos Precios de Productos". Ver
-- functions/api/recetas*.js.
-- ============================================

-- Catálogo de ingredientes: costo por bulto / cantidad por bulto ->
-- costo por fracción (unidad real usada en las recetas: kg, litro, unidad...)
CREATE TABLE IF NOT EXISTS recetas_ingredientes (
  id                  TEXT PRIMARY KEY,
  nombre              TEXT NOT NULL UNIQUE,
  costo_bulto         REAL DEFAULT 0,
  cantidad_bulto      REAL DEFAULT 1,
  costo_fraccion      REAL DEFAULT 0,
  fecha_actualizacion TEXT,
  observaciones       TEXT
);

-- Catálogo de costos fijos (mano de obra, alquiler, energía, etc.) — misma
-- forma que ingredientes, tabla separada porque son conceptualmente
-- distintos (no son "insumos" que se compran).
CREATE TABLE IF NOT EXISTS recetas_costos_fijos (
  id                  TEXT PRIMARY KEY,
  nombre              TEXT NOT NULL UNIQUE,
  costo_bulto         REAL DEFAULT 0,
  cantidad_bulto      REAL DEFAULT 1,
  costo_fraccion      REAL DEFAULT 0,
  fecha_actualizacion TEXT,
  observaciones       TEXT
);

-- Un producto/receta. El costo total, costo unitario y precio sugerido se
-- calculan a partir de sus líneas (ingredientes + costos fijos usados) —
-- no se guardan acá para que nunca queden desincronizados.
CREATE TABLE IF NOT EXISTS recetas_productos (
  id                   TEXT PRIMARY KEY,
  nombre               TEXT NOT NULL UNIQUE,
  unidades_por_tanda   REAL DEFAULT 1,
  utilidad_deseada_pct REAL DEFAULT 50,
  observaciones        TEXT,
  receta_texto         TEXT,
  activo               INTEGER NOT NULL DEFAULT 1,
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL
);

-- Ingredientes usados en cada receta, con la cantidad. El costo por unidad
-- se toma siempre en vivo de recetas_ingredientes — si actualizás el costo
-- de un ingrediente, todas las recetas que lo usan recalculan solas
-- (mismo comportamiento que tenía la planilla).
CREATE TABLE IF NOT EXISTS recetas_producto_ingredientes (
  id             TEXT PRIMARY KEY,
  producto_id    TEXT NOT NULL,
  ingrediente_id TEXT NOT NULL,
  cantidad       REAL DEFAULT 0
);

-- Costos fijos usados en cada receta (ej: horas de mano de obra), misma idea.
CREATE TABLE IF NOT EXISTS recetas_producto_costos_fijos (
  id            TEXT PRIMARY KEY,
  producto_id   TEXT NOT NULL,
  costo_fijo_id TEXT NOT NULL,
  cantidad      REAL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_recetas_proding_producto ON recetas_producto_ingredientes(producto_id);
CREATE INDEX IF NOT EXISTS idx_recetas_proding_ingrediente ON recetas_producto_ingredientes(ingrediente_id);
CREATE INDEX IF NOT EXISTS idx_recetas_prodcf_producto ON recetas_producto_costos_fijos(producto_id);
CREATE INDEX IF NOT EXISTS idx_recetas_prodcf_costofijo ON recetas_producto_costos_fijos(costo_fijo_id);

-- ============================================
-- LISTAS DE PRECIOS (Clientes / Mayoristas)
-- ============================================
-- Flujo: 1) "Sincronizar" copia los productos activos de Recetas que todavía
-- no están en el borrador de esta lista. 2) En el borrador se puede ajustar
-- el precio de cada uno (monto fijo o %) y sacar productos que no
-- correspondan en esta lista. El precio base se toma SIEMPRE en vivo de la
-- receta mientras está en borrador (igual que el resto del módulo). 3) Al
-- "Publicar" se congela el precio final de cada producto en
-- listas_precios_publicadas — esa foto queda fija hasta la próxima
-- publicación, sin importar que después cambien costos o el borrador.
CREATE TABLE IF NOT EXISTS listas_precios_borrador (
  id           TEXT PRIMARY KEY,
  lista        TEXT NOT NULL CHECK (lista IN ('clientes','mayoristas')),
  producto_id  TEXT NOT NULL,
  nombre_cache TEXT NOT NULL,
  ajuste_tipo  TEXT NOT NULL DEFAULT 'monto' CHECK (ajuste_tipo IN ('monto','porcentaje')),
  ajuste_valor REAL NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_listaborrador_unico ON listas_precios_borrador(lista, producto_id);

CREATE TABLE IF NOT EXISTS listas_precios_publicadas (
  id           TEXT PRIMARY KEY,
  lista        TEXT NOT NULL CHECK (lista IN ('clientes','mayoristas')),
  producto_id  TEXT,
  nombre       TEXT NOT NULL,
  precio_final REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_listapublicada_lista ON listas_precios_publicadas(lista);

CREATE TABLE IF NOT EXISTS listas_precios_meta (
  lista        TEXT PRIMARY KEY CHECK (lista IN ('clientes','mayoristas')),
  published_at TEXT NOT NULL
);
