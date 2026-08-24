/**
 * Cloudflare Pages Function — /api/mayoristas-listas
 *
 * Listas de productos reutilizables para armar remitos a mayoristas (ej:
 * "Cafeterías chicas", "Panaderías"). Cada mayoristas_clientes tiene una de
 * estas asignada, y solo puede elegir esos productos al armar su remito.
 *
 * GET    /api/mayoristas-listas             → todas las listas, con sus productos
 * GET    /api/mayoristas-listas?id=         → una lista con sus productos
 * POST   /api/mayoristas-listas             → crear { nombre }
 * PUT    /api/mayoristas-listas?id=         → renombrar { nombre }
 * DELETE /api/mayoristas-listas?id=         → eliminar (bloqueado si algún cliente la usa)
 *
 * POST   /api/mayoristas-listas?id=&accion=agregar-producto    body:{ producto_id }
 * DELETE /api/mayoristas-listas?id=&accion=quitar-producto&producto_id=
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

async function conProductos(db, lista) {
  const { results: items } = await db.prepare(
    `SELECT lp.producto_id, p.nombre
     FROM mayoristas_listas_productos lp
     JOIN recetas_productos p ON p.id = lp.producto_id
     WHERE lp.lista_id = ? ORDER BY p.nombre COLLATE NOCASE`
  ).bind(lista.id).all();
  return { ...lista, productos: items };
}

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method.toUpperCase();
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  const accion = url.searchParams.get('accion');

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

  // ── Agregar / quitar un producto de una lista ────────────────
  if (id && accion === 'agregar-producto' && method === 'POST') {
    let body;
    try { body = await request.json(); } catch { return json({ error: 'Body inválido.' }, 400); }
    if (!body.producto_id) return json({ error: 'Falta producto_id.' }, 400);
    try {
      await db.prepare('INSERT INTO mayoristas_listas_productos (id, lista_id, producto_id) VALUES (?, ?, ?)')
        .bind(crypto.randomUUID(), id, body.producto_id).run();
    } catch (e) {
      if (String(e.message).includes('UNIQUE')) return json({ error: 'Ese producto ya está en la lista.' }, 400);
      throw e;
    }
    return json({ ok: true });
  }

  if (id && accion === 'quitar-producto' && method === 'DELETE') {
    const productoId = url.searchParams.get('producto_id');
    if (!productoId) return json({ error: 'Falta producto_id.' }, 400);
    await db.prepare('DELETE FROM mayoristas_listas_productos WHERE lista_id = ? AND producto_id = ?')
      .bind(id, productoId).run();
    return json({ ok: true });
  }

  // ── GET detalle ───────────────────────────────────────────────
  if (method === 'GET' && id) {
    const lista = await db.prepare('SELECT * FROM mayoristas_listas WHERE id = ?').bind(id).first();
    if (!lista) return json({ error: 'Lista no encontrada.' }, 404);
    return json({ ok: true, lista: await conProductos(db, lista) });
  }

  // ── GET listado ───────────────────────────────────────────────
  if (method === 'GET') {
    const { results: listas } = await db.prepare('SELECT * FROM mayoristas_listas ORDER BY nombre COLLATE NOCASE').all();
    const conTodo = await Promise.all(listas.map(l => conProductos(db, l)));
    return json({ ok: true, listas: conTodo });
  }

  // ── CREAR ─────────────────────────────────────────────────────
  if (method === 'POST') {
    let body;
    try { body = await request.json(); } catch { return json({ error: 'Body inválido.' }, 400); }
    const nombre = (body.nombre || '').toString().trim();
    if (!nombre) return json({ error: 'Falta el campo: nombre' }, 400);

    const nuevoId = crypto.randomUUID();
    try {
      await db.prepare('INSERT INTO mayoristas_listas (id, nombre, created_at) VALUES (?, ?, ?)')
        .bind(nuevoId, nombre, new Date().toISOString()).run();
    } catch (e) {
      if (String(e.message).includes('UNIQUE')) return json({ error: 'Ya existe una lista con ese nombre.' }, 400);
      throw e;
    }
    return json({ ok: true, id: nuevoId });
  }

  // ── RENOMBRAR ─────────────────────────────────────────────────
  if (method === 'PUT') {
    if (!id) return json({ error: 'Falta el parámetro id.' }, 400);
    let body;
    try { body = await request.json(); } catch { return json({ error: 'Body inválido.' }, 400); }
    const nombre = (body.nombre || '').toString().trim();
    if (!nombre) return json({ error: 'Falta el campo: nombre' }, 400);
    try {
      await db.prepare('UPDATE mayoristas_listas SET nombre = ? WHERE id = ?').bind(nombre, id).run();
    } catch (e) {
      if (String(e.message).includes('UNIQUE')) return json({ error: 'Ya existe otra lista con ese nombre.' }, 400);
      throw e;
    }
    return json({ ok: true });
  }

  // ── ELIMINAR ──────────────────────────────────────────────────
  if (method === 'DELETE') {
    if (!id) return json({ error: 'Falta el parámetro id.' }, 400);
    const enUso = await db.prepare('SELECT id FROM mayoristas_clientes WHERE lista_id = ? LIMIT 1').bind(id).first();
    if (enUso) return json({ error: 'No se puede eliminar: hay al menos un cliente usando esta lista.' }, 400);
    await db.batch([
      db.prepare('DELETE FROM mayoristas_listas_productos WHERE lista_id = ?').bind(id),
      db.prepare('DELETE FROM mayoristas_listas WHERE id = ?').bind(id),
    ]);
    return json({ ok: true });
  }

  return json({ error: 'Método no permitido.' }, 405);
}
