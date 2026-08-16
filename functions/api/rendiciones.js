/**
 * Cloudflare Pages Function — /api/rendiciones
 *
 * GET    /api/rendiciones?local=&turno=&desde=&hasta=  → listar (filtros opcionales)
 * POST   /api/rendiciones                               → crear
 * POST   /api/rendiciones?action=bulk-import             → importación masiva (admin, X-Admin-Token)
 * DELETE /api/rendiciones?id=                           → eliminar
 *
 * Requiere el binding D1: RENDICIONES_DB (ver wrangler.jsonc y schema.sql)
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
};

const DENOMINACIONES = [10, 20, 50, 100, 200, 500, 1000, 2000, 10000, 20000];
const MEDIOS_PAGO = ['debito', 'credito', 'qr', 'mp_point', 'pedidos_ya', 'transferencia'];

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function isAdmin(request, env) {
  const token = request.headers.get('X-Admin-Token') || '';
  return !!env.ADMIN_TOKEN && token === env.ADMIN_TOKEN;
}

function buildRow(body) {
  const row = {
    id: crypto.randomUUID(),
    local_id: String(body.local_id),
    local_nombre: body.local_nombre ? String(body.local_nombre) : '',
    turno: String(body.turno),
    empleado_id: body.empleado_id ? String(body.empleado_id) : '',
    empleado_nombre: body.empleado_nombre ? String(body.empleado_nombre) : '',
    fecha: String(body.fecha),
    total_efectivo: Number(body.total_efectivo) || 0,
    total_real: Number(body.total_real) || 0,
    registrado_sistema: Number(body.registrado_sistema) || 0,
    diferencia: Number(body.diferencia) || 0,
    observaciones: body.observaciones ? String(body.observaciones) : '',
    created_at: body.created_at || new Date().toISOString(),
  };
  DENOMINACIONES.forEach(d => { row[`billetes_${d}`] = Number(body[`billetes_${d}`]) || 0; });
  MEDIOS_PAGO.forEach(m => { row[m] = Number(body[m]) || 0; });
  return row;
}

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method.toUpperCase();
  const url = new URL(request.url);

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (!env.RENDICIONES_DB) {
    return json({ error: 'Binding D1 "RENDICIONES_DB" no encontrado. Ver wrangler.jsonc.' }, 500);
  }

  // ── LISTAR (con filtros opcionales) ─────────────────────────
  if (method === 'GET') {
    const local = url.searchParams.get('local');
    const turno = url.searchParams.get('turno');
    const desde = url.searchParams.get('desde');
    const hasta = url.searchParams.get('hasta');

    let sql = 'SELECT * FROM rendiciones WHERE 1=1';
    const binds = [];
    if (local) { sql += ' AND local_id = ?'; binds.push(local); }
    if (turno) { sql += ' AND turno = ?'; binds.push(turno); }
    if (desde) { sql += ' AND fecha >= ?'; binds.push(desde); }
    if (hasta) { sql += ' AND fecha <= ?'; binds.push(hasta); }
    sql += ' ORDER BY fecha DESC, created_at DESC';

    const stmt = binds.length ? env.RENDICIONES_DB.prepare(sql).bind(...binds) : env.RENDICIONES_DB.prepare(sql);
    const { results } = await stmt.all();
    return json({ ok: true, rendiciones: results });
  }

  // ── IMPORTACIÓN MASIVA (admin) ──────────────────────────────
  if (method === 'POST' && url.searchParams.get('action') === 'bulk-import') {
    if (!isAdmin(request, env)) return json({ error: 'No autorizado.' }, 401);

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Body inválido.' }, 400);
    }

    const rows = Array.isArray(body.rows) ? body.rows : null;
    if (!rows || rows.length === 0) return json({ error: 'Falta el array "rows".' }, 400);
    if (rows.length > 1000) return json({ error: 'Máximo 1000 filas por lote.' }, 400);

    const built = rows.map(buildRow);
    const columns = Object.keys(built[0]);
    const placeholders = columns.map(() => '?').join(', ');
    const sql = `INSERT INTO rendiciones (${columns.join(', ')}) VALUES (${placeholders})`;
    const stmts = built.map(row => env.RENDICIONES_DB.prepare(sql).bind(...columns.map(c => row[c])));

    await env.RENDICIONES_DB.batch(stmts);

    return json({ ok: true, inserted: built.length });
  }

  // ── CREAR ────────────────────────────────────────────────────
  if (method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Body inválido.' }, 400);
    }

    for (const f of ['local_id', 'turno', 'fecha', 'empleado_id']) {
      if (!body[f]) return json({ error: `Falta el campo: ${f}` }, 400);
    }

    const row = buildRow(body);
    const columns = Object.keys(row);
    const placeholders = columns.map(() => '?').join(', ');
    const sql = `INSERT INTO rendiciones (${columns.join(', ')}) VALUES (${placeholders})`;

    await env.RENDICIONES_DB.prepare(sql).bind(...columns.map(c => row[c])).run();

    return json({ ok: true, id: row.id });
  }

  // ── ELIMINAR ─────────────────────────────────────────────────
  if (method === 'DELETE') {
    const id = url.searchParams.get('id');
    if (!id) return json({ error: 'Falta el parámetro id.' }, 400);
    await env.RENDICIONES_DB.prepare('DELETE FROM rendiciones WHERE id = ?').bind(id).run();
    return json({ ok: true });
  }

  return json({ error: 'Método no permitido.' }, 405);
}
