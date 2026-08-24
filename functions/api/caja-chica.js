/**
 * Cloudflare Pages Function — /api/caja-chica
 *
 * GET    /api/caja-chica?local=&estado=&desde=&hasta=&clasificacion=&q=
 *          → listar movimientos (filtros opcionales).
 *          Si estado=enviado y local viene con valor, el saldo acumulado se
 *          calcula sobre TODO el historial del local (no solo lo filtrado)
 *          para que la columna "Saldo" de la planilla maestra sea correcta,
 *          y recién ahí se aplican el resto de los filtros.
 * POST   /api/caja-chica                    → crear movimiento (estado=pendiente)
 * POST   /api/caja-chica?action=cerrar      → cerrar caja de un local: exige
 *          que la suma de pendientes (ingreso-egreso) sea $0, y pasa todo a
 *          estado=enviado agrupado en un mismo lote_envio.
 * POST   /api/caja-chica?action=bulk-import → importación masiva (admin, X-Admin-Token)
 * PUT    /api/caja-chica?id=                → editar un movimiento (solo si está pendiente)
 * DELETE /api/caja-chica?id=                → eliminar un movimiento (solo si está pendiente,
 *          o con X-Admin-Token para corregir historial ya enviado)
 *
 * Requiere el binding D1: RENDICIONES_DB (mismo D1 que rendiciones, ver wrangler.jsonc)
 */

import { obtenerSesion, tieneRol, tieneLocal } from '../lib/session.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token, Authorization',
};

const EPSILON = 0.5; // tolerancia de redondeo para considerar el saldo "en cero"

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
  return {
    id: crypto.randomUUID(),
    local_id: String(body.local_id || ''),
    local_nombre: body.local_nombre ? String(body.local_nombre) : '',
    fecha: String(body.fecha || ''),
    item: String(body.item || ''),
    clasificacion: String(body.clasificacion || ''),
    detalle: body.detalle ? String(body.detalle) : '',
    ingreso: Number(body.ingreso) || 0,
    egreso: Number(body.egreso) || 0,
    estado: body.estado === 'enviado' ? 'enviado' : 'pendiente',
    lote_envio: body.lote_envio ? String(body.lote_envio) : null,
    fecha_envio: body.fecha_envio ? String(body.fecha_envio) : null,
    creado_por: body.creado_por ? String(body.creado_por) : '',
    created_at: body.created_at || new Date().toISOString(),
  };
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

  const esBulkImport = method === 'POST' && url.searchParams.get('action') === 'bulk-import';
  const session = esBulkImport ? null : await obtenerSesion(request, env);

  // ── LISTAR ───────────────────────────────────────────────────
  if (method === 'GET') {
    const local = url.searchParams.get('local');
    const estado = url.searchParams.get('estado');
    const desde = url.searchParams.get('desde');
    const hasta = url.searchParams.get('hasta');
    const clasificacion = url.searchParams.get('clasificacion');
    const q = (url.searchParams.get('q') || '').trim().toLowerCase();

    // La planilla maestra (estado=enviado) es sensible: solo dueño/supervisor,
    // igual que la página que la muestra (caja-chica/historial.html).
    if (estado === 'enviado') {
      if (!tieneRol(session, 'owner', 'supervisor')) return json({ error: 'No autorizado.' }, 403);
    } else if (!local || !tieneLocal(session, local)) {
      // Carga de trabajo (pendientes): hace falta tener ese local asignado.
      return json({ error: 'No autenticado o sin acceso a ese local.' }, 401);
    }

    if (estado === 'enviado' && local) {
      const { results: all } = await env.RENDICIONES_DB
        .prepare('SELECT * FROM caja_chica_movimientos WHERE local_id = ? AND estado = ? ORDER BY fecha ASC, created_at ASC')
        .bind(local, 'enviado')
        .all();

      let running = 0;
      const conSaldo = all.map(r => {
        running += (r.ingreso || 0) - (r.egreso || 0);
        return { ...r, saldo: Math.round(running * 100) / 100 };
      });

      const filtrado = conSaldo.filter(r => {
        if (desde && r.fecha < desde) return false;
        if (hasta && r.fecha > hasta) return false;
        if (clasificacion && r.clasificacion !== clasificacion) return false;
        if (q && !(`${r.item} ${r.detalle || ''}`.toLowerCase().includes(q))) return false;
        return true;
      }).reverse(); // más reciente primero

      return json({ ok: true, movimientos: filtrado });
    }

    let sql = 'SELECT * FROM caja_chica_movimientos WHERE 1=1';
    const binds = [];
    if (local) { sql += ' AND local_id = ?'; binds.push(local); }
    if (estado) { sql += ' AND estado = ?'; binds.push(estado); }
    if (desde) { sql += ' AND fecha >= ?'; binds.push(desde); }
    if (hasta) { sql += ' AND fecha <= ?'; binds.push(hasta); }
    if (clasificacion) { sql += ' AND clasificacion = ?'; binds.push(clasificacion); }
    sql += ' ORDER BY fecha ASC, created_at ASC';

    const stmt = binds.length ? env.RENDICIONES_DB.prepare(sql).bind(...binds) : env.RENDICIONES_DB.prepare(sql);
    let { results } = await stmt.all();
    if (q) results = results.filter(r => `${r.item} ${r.detalle || ''}`.toLowerCase().includes(q));

    return json({ ok: true, movimientos: results });
  }

  // ── CERRAR CAJA (enviar pendientes a la planilla maestra) ───────
  if (method === 'POST' && url.searchParams.get('action') === 'cerrar') {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Body inválido.' }, 400);
    }

    const localId = body.local_id;
    if (!localId) return json({ error: 'Falta el campo: local_id' }, 400);
    if (!tieneLocal(session, localId)) return json({ error: 'No tenés acceso a ese local.' }, 403);

    const { results: pendientes } = await env.RENDICIONES_DB
      .prepare('SELECT * FROM caja_chica_movimientos WHERE local_id = ? AND estado = ?')
      .bind(localId, 'pendiente')
      .all();

    if (pendientes.length === 0) {
      return json({ error: 'No hay movimientos pendientes para enviar.' }, 400);
    }

    const saldo = pendientes.reduce((s, r) => s + (r.ingreso || 0) - (r.egreso || 0), 0);
    if (Math.abs(saldo) > EPSILON) {
      return json({
        error: `El saldo debe estar en $0 antes de enviar. Saldo actual: ${saldo > 0 ? '+' : ''}${Math.round(saldo)}.`,
        saldo,
      }, 400);
    }

    const loteEnvio = crypto.randomUUID();
    const fechaEnvio = new Date().toISOString();

    await env.RENDICIONES_DB
      .prepare('UPDATE caja_chica_movimientos SET estado = ?, lote_envio = ?, fecha_envio = ? WHERE local_id = ? AND estado = ?')
      .bind('enviado', loteEnvio, fechaEnvio, localId, 'pendiente')
      .run();

    return json({ ok: true, enviados: pendientes.length, lote_envio: loteEnvio });
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
    const sql = `INSERT INTO caja_chica_movimientos (${columns.join(', ')}) VALUES (${placeholders})`;
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

    for (const f of ['local_id', 'fecha', 'item', 'clasificacion']) {
      if (!body[f]) return json({ error: `Falta el campo: ${f}` }, 400);
    }
    if (!tieneLocal(session, body.local_id)) return json({ error: 'No tenés acceso a ese local.' }, 403);
    if (!(Number(body.ingreso) > 0) && !(Number(body.egreso) > 0)) {
      return json({ error: 'El movimiento necesita un monto de ingreso o egreso.' }, 400);
    }

    const row = buildRow(body);
    const columns = Object.keys(row);
    const placeholders = columns.map(() => '?').join(', ');
    const sql = `INSERT INTO caja_chica_movimientos (${columns.join(', ')}) VALUES (${placeholders})`;

    await env.RENDICIONES_DB.prepare(sql).bind(...columns.map(c => row[c])).run();

    return json({ ok: true, id: row.id });
  }

  // ── EDITAR (solo pendientes) ────────────────────────────────
  if (method === 'PUT') {
    const id = url.searchParams.get('id');
    if (!id) return json({ error: 'Falta el parámetro id.' }, 400);

    const existing = await env.RENDICIONES_DB.prepare('SELECT * FROM caja_chica_movimientos WHERE id = ?').bind(id).first();
    if (!existing) return json({ error: 'Movimiento no encontrado.' }, 404);
    if (!tieneLocal(session, existing.local_id)) return json({ error: 'No tenés acceso a ese local.' }, 403);
    if (existing.estado !== 'pendiente') {
      return json({ error: 'No se puede editar un movimiento ya enviado a la planilla maestra.' }, 400);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Body inválido.' }, 400);
    }

    const fecha = body.fecha ? String(body.fecha) : existing.fecha;
    const item = body.item ? String(body.item) : existing.item;
    const clasificacion = body.clasificacion ? String(body.clasificacion) : existing.clasificacion;
    const detalle = body.detalle !== undefined ? String(body.detalle) : existing.detalle;
    const ingreso = body.ingreso !== undefined ? Number(body.ingreso) || 0 : existing.ingreso;
    const egreso = body.egreso !== undefined ? Number(body.egreso) || 0 : existing.egreso;

    await env.RENDICIONES_DB
      .prepare('UPDATE caja_chica_movimientos SET fecha=?, item=?, clasificacion=?, detalle=?, ingreso=?, egreso=? WHERE id=?')
      .bind(fecha, item, clasificacion, detalle, ingreso, egreso, id)
      .run();

    return json({ ok: true });
  }

  // ── ELIMINAR ─────────────────────────────────────────────────
  if (method === 'DELETE') {
    const id = url.searchParams.get('id');
    if (!id) return json({ error: 'Falta el parámetro id.' }, 400);

    const existing = await env.RENDICIONES_DB.prepare('SELECT * FROM caja_chica_movimientos WHERE id = ?').bind(id).first();
    if (!existing) return json({ ok: true }); // ya no está, nada que hacer

    if (existing.estado !== 'pendiente' && !isAdmin(request, env)) {
      return json({ error: 'No se puede eliminar un movimiento ya enviado a la planilla maestra.' }, 400);
    }
    if (existing.estado === 'pendiente' && !tieneLocal(session, existing.local_id)) {
      return json({ error: 'No tenés acceso a ese local.' }, 403);
    }

    await env.RENDICIONES_DB.prepare('DELETE FROM caja_chica_movimientos WHERE id = ?').bind(id).run();
    return json({ ok: true });
  }

  return json({ error: 'Método no permitido.' }, 405);
}
