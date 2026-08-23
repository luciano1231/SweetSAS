/**
 * Cloudflare Pages Function — /api/obligaciones
 *
 * GET    /api/obligaciones?desde=&hasta=&banco=&obligacion=&sinClasificar=1&q=
 * PUT    /api/obligaciones?id=   → editar una fila. Si cambia la
 *          Obligación, el sistema "aprende" al toque (memoria +
 *          alta automática en la clasificación general) — el
 *          equivalente web del onEdit que tenía en Google Sheets.
 * DELETE /api/obligaciones?id=
 *
 * Requiere el binding D1: RENDICIONES_DB
 */

import { agregarObligacionesSiFaltan } from './obligaciones-upload.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
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

  // ── LISTAR ───────────────────────────────────────────────────
  if (method === 'GET') {
    const desde = url.searchParams.get('desde');
    const hasta = url.searchParams.get('hasta');
    const banco = url.searchParams.get('banco');
    const obligacion = url.searchParams.get('obligacion');
    const sinClasificar = url.searchParams.get('sinClasificar');
    const q = (url.searchParams.get('q') || '').trim().toLowerCase();

    let sql = 'SELECT * FROM obligaciones_movimientos WHERE 1=1';
    const binds = [];
    if (desde) { sql += ' AND fecha >= ?'; binds.push(desde); }
    if (hasta) { sql += ' AND fecha <= ?'; binds.push(hasta); }
    if (banco) { sql += ' AND banco = ?'; binds.push(banco); }
    if (obligacion) { sql += ' AND obligacion = ?'; binds.push(obligacion); }
    if (sinClasificar === '1') { sql += " AND obligacion = 'SIN CLASIFICAR'"; }
    sql += ' ORDER BY fecha DESC, created_at DESC';

    const stmt = binds.length ? env.RENDICIONES_DB.prepare(sql).bind(...binds) : env.RENDICIONES_DB.prepare(sql);
    let { results } = await stmt.all();
    if (q) {
      results = results.filter(r =>
        `${r.observacion} ${r.obligacion} ${r.de_quien_la_deuda || ''} ${r.origen_del_dinero || ''}`.toLowerCase().includes(q)
      );
    }

    return json({ ok: true, movimientos: results });
  }

  // ── EDITAR (dispara aprendizaje si cambia la Obligación) ────────
  if (method === 'PUT') {
    const id = url.searchParams.get('id');
    if (!id) return json({ error: 'Falta el parámetro id.' }, 400);

    const existente = await env.RENDICIONES_DB.prepare('SELECT * FROM obligaciones_movimientos WHERE id = ?').bind(id).first();
    if (!existente) return json({ error: 'Movimiento no encontrado.' }, 404);

    let body;
    try { body = await request.json(); } catch { return json({ error: 'Body inválido.' }, 400); }

    const obligacion       = body.obligacion !== undefined ? String(body.obligacion).trim() : existente.obligacion;
    const deQuienLaDeuda   = body.de_quien_la_deuda !== undefined ? String(body.de_quien_la_deuda).trim() : existente.de_quien_la_deuda;
    const origenDelDinero  = body.origen_del_dinero !== undefined ? String(body.origen_del_dinero).trim() : existente.origen_del_dinero;
    const observacion      = body.observacion !== undefined ? String(body.observacion).trim() : existente.observacion;

    await env.RENDICIONES_DB
      .prepare('UPDATE obligaciones_movimientos SET obligacion=?, de_quien_la_deuda=?, origen_del_dinero=?, observacion=? WHERE id=?')
      .bind(obligacion, deQuienLaDeuda, origenDelDinero, observacion, id)
      .run();

    // Motor de aprendizaje: si el cliente clasificó (o reclasificó) esta
    // fila a mano, lo memorizamos para la próxima vez que aparezca la
    // misma observación, y damos de alta la Obligación para los resúmenes.
    const cambioClasificacion = obligacion && obligacion !== existente.obligacion;
    if (cambioClasificacion && obligacion.toUpperCase() !== 'SIN CLASIFICAR' && observacion) {
      await env.RENDICIONES_DB.prepare(
        `INSERT INTO obligaciones_aprendizaje (id, observacion, obligacion, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(observacion) DO UPDATE SET obligacion = excluded.obligacion, updated_at = excluded.updated_at`
      ).bind(crypto.randomUUID(), observacion, obligacion, new Date().toISOString()).run();

      await agregarObligacionesSiFaltan(env, [obligacion]);
    }

    return json({ ok: true });
  }

  // ── ELIMINAR ─────────────────────────────────────────────────
  if (method === 'DELETE') {
    const id = url.searchParams.get('id');
    if (!id) return json({ error: 'Falta el parámetro id.' }, 400);
    await env.RENDICIONES_DB.prepare('DELETE FROM obligaciones_movimientos WHERE id = ?').bind(id).run();
    return json({ ok: true });
  }

  return json({ error: 'Método no permitido.' }, 405);
}
