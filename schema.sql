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
