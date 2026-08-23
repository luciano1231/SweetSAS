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
