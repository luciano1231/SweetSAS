/**
 * Cloudflare Pages Function — /api/mayoristas-ledger
 *
 * Libro mayor de remitos ya cerrados (una fila por producto, igual que
 * "Detalles de Remitos" en la planilla vieja). Queda editable después de
 * cerrado: Enviado/Recibido/Pagado y Observaciones se pueden seguir
 * marcando a medida que pasa en la realidad — el resto (producto, cantidad,
 * precio, N° de remito) no se toca más.
 *
 * GET    ?cliente_id=&desde=&hasta=&limit=&offset=   → filtros opcionales
 * PUT    ?id=   body:{ enviado?, recibido?, pagado?, observaciones? }
 *
 * Requiere el binding D1: RENDICIONES_DB. Acceso: dueño/supervisor.
 */

import { obtenerSesion, tieneRol } from '../lib/session.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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
  const id = url.searchParams.get('id');

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (!env.RENDICIONES_DB) {
    return json({ error: 'Binding D1 "RENDICIONES_DB" no encontrado. Ver wrangler.jsonc.' }, 500);
  }

  const session = await obtenerSesion(request, env);
  if (!tieneRol(session, 'owner', 'supervisor')) {
    return json({ error: 'No autorizado.' }, 403);
  }

  const db = env.RENDICIONES_DB;

  if (method === 'GET') {
    const clienteId = url.searchParams.get('cliente_id');
    const desde = url.searchParams.get('desde');
    const hasta = url.searchParams.get('hasta');
    const limit = Math.min(Number(url.searchParams.get('limit')) || 200, 500);
    const offset = Number(url.searchParams.get('offset')) || 0;

    const condiciones = [];
    const params = [];
    if (clienteId) { condiciones.push('cliente_id = ?'); params.push(clienteId); }
    if (desde) { condiciones.push('fecha >= ?'); params.push(desde); }
    if (hasta) { condiciones.push('fecha <= ?'); params.push(hasta); }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

    const totalRow = await db.prepare(`SELECT COUNT(*) as c FROM mayoristas_remitos_cerrados ${where}`).bind(...params).first();
    const { results: filas } = await db.prepare(
      `SELECT * FROM mayoristas_remitos_cerrados ${where} ORDER BY fecha DESC, created_at DESC LIMIT ? OFFSET ?`
    ).bind(...params, limit, offset).all();

    return json({ ok: true, filas, total: totalRow.c, limit, offset });
  }

  if (method === 'PUT') {
    if (!id) return json({ error: 'Falta el parámetro id.' }, 400);
    const existente = await db.prepare('SELECT * FROM mayoristas_remitos_cerrados WHERE id = ?').bind(id).first();
    if (!existente) return json({ error: 'Línea no encontrada.' }, 404);

    let body;
    try { body = await request.json(); } catch { return json({ error: 'Body inválido.' }, 400); }

    const enviado = body.enviado !== undefined ? (body.enviado ? 1 : 0) : existente.enviado;
    const recibido = body.recibido !== undefined ? (body.recibido ? 1 : 0) : existente.recibido;
    const pagado = body.pagado !== undefined ? (body.pagado ? 1 : 0) : existente.pagado;
    const observaciones = body.observaciones !== undefined ? String(body.observaciones) : existente.observaciones;

    await db.prepare(
      'UPDATE mayoristas_remitos_cerrados SET enviado=?, recibido=?, pagado=?, observaciones=? WHERE id=?'
    ).bind(enviado, recibido, pagado, observaciones, id).run();
    return json({ ok: true });
  }

  return json({ error: 'Método no permitido.' }, 405);
}
