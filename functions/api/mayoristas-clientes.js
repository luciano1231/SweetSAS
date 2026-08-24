/**
 * Cloudflare Pages Function — /api/mayoristas-clientes
 *
 * Clientes mayoristas: cada uno tiene una lista de productos asignada (qué
 * puede pedir) y su propio contador de N° de remito.
 *
 * GET    /api/mayoristas-clientes           → listado (con nombre de su lista)
 * GET    /api/mayoristas-clientes?id=       → un cliente
 * POST   /api/mayoristas-clientes           → crear { nombre, lista_id?, color?, proximo_remito_numero? }
 * PUT    /api/mayoristas-clientes?id=       → editar (mismos campos + activo?)
 * DELETE /api/mayoristas-clientes?id=       → eliminar (bloqueado si tiene remito abierto con líneas o historial)
 *
 * Requiere el binding D1: RENDICIONES_DB. Acceso: dueño/supervisor.
 */

import { obtenerSesion, tieneRol } from '../lib/session.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

const SELECT_CON_LISTA = `
  SELECT c.*, l.nombre as lista_nombre
  FROM mayoristas_clientes c
  LEFT JOIN mayoristas_listas l ON l.id = c.lista_id
`;

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

  if (method === 'GET' && id) {
    const cliente = await db.prepare(`${SELECT_CON_LISTA} WHERE c.id = ?`).bind(id).first();
    if (!cliente) return json({ error: 'Cliente no encontrado.' }, 404);
    return json({ ok: true, cliente });
  }

  if (method === 'GET') {
    const { results: clientes } = await db.prepare(`${SELECT_CON_LISTA} ORDER BY c.nombre COLLATE NOCASE`).all();
    return json({ ok: true, clientes });
  }

  if (method === 'POST') {
    let body;
    try { body = await request.json(); } catch { return json({ error: 'Body inválido.' }, 400); }
    const nombre = (body.nombre || '').toString().trim();
    if (!nombre) return json({ error: 'Falta el campo: nombre' }, 400);

    const nuevoId = crypto.randomUUID();
    try {
      await db.prepare(
        `INSERT INTO mayoristas_clientes (id, nombre, lista_id, color, proximo_remito_numero, activo, created_at)
         VALUES (?, ?, ?, ?, ?, 1, ?)`
      ).bind(
        nuevoId, nombre,
        body.lista_id || null,
        body.color || null,
        Number(body.proximo_remito_numero) > 0 ? Math.round(Number(body.proximo_remito_numero)) : 1,
        new Date().toISOString()
      ).run();
    } catch (e) {
      if (String(e.message).includes('UNIQUE')) return json({ error: 'Ya existe un cliente con ese nombre.' }, 400);
      throw e;
    }
    return json({ ok: true, id: nuevoId });
  }

  if (method === 'PUT') {
    if (!id) return json({ error: 'Falta el parámetro id.' }, 400);
    const existente = await db.prepare('SELECT * FROM mayoristas_clientes WHERE id = ?').bind(id).first();
    if (!existente) return json({ error: 'Cliente no encontrado.' }, 404);

    let body;
    try { body = await request.json(); } catch { return json({ error: 'Body inválido.' }, 400); }

    const nombre = body.nombre !== undefined ? String(body.nombre).trim() : existente.nombre;
    const listaId = body.lista_id !== undefined ? (body.lista_id || null) : existente.lista_id;
    const color = body.color !== undefined ? body.color : existente.color;
    const proximo = body.proximo_remito_numero !== undefined ? (Number(body.proximo_remito_numero) || existente.proximo_remito_numero) : existente.proximo_remito_numero;
    const activo = body.activo !== undefined ? (body.activo ? 1 : 0) : existente.activo;

    try {
      await db.prepare(
        'UPDATE mayoristas_clientes SET nombre=?, lista_id=?, color=?, proximo_remito_numero=?, activo=? WHERE id=?'
      ).bind(nombre, listaId, color, proximo, activo, id).run();
    } catch (e) {
      if (String(e.message).includes('UNIQUE')) return json({ error: 'Ya existe otro cliente con ese nombre.' }, 400);
      throw e;
    }
    return json({ ok: true });
  }

  if (method === 'DELETE') {
    if (!id) return json({ error: 'Falta el parámetro id.' }, 400);
    const conHistorial = await db.prepare('SELECT id FROM mayoristas_remitos_cerrados WHERE cliente_id = ? LIMIT 1').bind(id).first();
    if (conHistorial) return json({ error: 'No se puede eliminar: este cliente ya tiene remitos cerrados en el historial. Deshabilitalo en vez de borrarlo.' }, 400);
    await db.batch([
      db.prepare('DELETE FROM mayoristas_remito_lineas WHERE cliente_id = ?').bind(id),
      db.prepare('DELETE FROM mayoristas_clientes WHERE id = ?').bind(id),
    ]);
    return json({ ok: true });
  }

  return json({ error: 'Método no permitido.' }, 405);
}
