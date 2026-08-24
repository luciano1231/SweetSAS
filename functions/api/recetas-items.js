/**
 * Cloudflare Pages Function — /api/recetas-items
 *
 * Líneas de una receta (qué ingredientes o costos fijos usa, y cuánto).
 *
 *   ?tipo=ingrediente | costofijo
 *
 * POST   ?tipo=...        body: { producto_id, ingrediente_id|costo_fijo_id, cantidad } → agregar
 * PUT    ?tipo=...&id=    body: { cantidad }                                             → editar cantidad
 * DELETE ?tipo=...&id=                                                                    → quitar
 *
 * Requiere el binding D1: RENDICIONES_DB. Acceso: dueño/supervisor.
 */

import { obtenerSesion, tieneRol } from '../lib/session.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, PUT, DELETE, OPTIONS',
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
  const tipo = url.searchParams.get('tipo');

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

  if (tipo !== 'ingrediente' && tipo !== 'costofijo') {
    return json({ error: 'Falta o es inválido el parámetro tipo (ingrediente | costofijo).' }, 400);
  }

  const tabla = tipo === 'ingrediente' ? 'recetas_producto_ingredientes' : 'recetas_producto_costos_fijos';
  const columnaRef = tipo === 'ingrediente' ? 'ingrediente_id' : 'costo_fijo_id';
  const catalogoTabla = tipo === 'ingrediente' ? 'recetas_ingredientes' : 'recetas_costos_fijos';

  if (method === 'POST') {
    let body;
    try { body = await request.json(); } catch { return json({ error: 'Body inválido.' }, 400); }

    const productoId = body.producto_id;
    const refId = body[columnaRef];
    const cantidad = Number(body.cantidad);

    if (!productoId || !refId) return json({ error: `Faltan campos: producto_id, ${columnaRef}` }, 400);
    if (!(cantidad > 0)) return json({ error: 'La cantidad tiene que ser mayor a 0.' }, 400);

    const producto = await env.RENDICIONES_DB.prepare('SELECT id FROM recetas_productos WHERE id = ?').bind(productoId).first();
    if (!producto) return json({ error: 'Producto no encontrado.' }, 404);
    const ref = await env.RENDICIONES_DB.prepare(`SELECT id FROM ${catalogoTabla} WHERE id = ?`).bind(refId).first();
    if (!ref) return json({ error: 'Ítem de catálogo no encontrado.' }, 404);

    const yaExiste = await env.RENDICIONES_DB.prepare(`SELECT id FROM ${tabla} WHERE producto_id = ? AND ${columnaRef} = ?`).bind(productoId, refId).first();
    if (yaExiste) return json({ error: 'Esta receta ya tiene ese ítem — editá la cantidad en vez de agregarlo de nuevo.' }, 400);

    const nuevoId = crypto.randomUUID();
    await env.RENDICIONES_DB.prepare(
      `INSERT INTO ${tabla} (id, producto_id, ${columnaRef}, cantidad) VALUES (?, ?, ?, ?)`
    ).bind(nuevoId, productoId, refId, cantidad).run();

    return json({ ok: true, id: nuevoId });
  }

  if (method === 'PUT') {
    const id = url.searchParams.get('id');
    if (!id) return json({ error: 'Falta el parámetro id.' }, 400);

    let body;
    try { body = await request.json(); } catch { return json({ error: 'Body inválido.' }, 400); }
    const cantidad = Number(body.cantidad);
    if (!(cantidad > 0)) return json({ error: 'La cantidad tiene que ser mayor a 0.' }, 400);

    await env.RENDICIONES_DB.prepare(`UPDATE ${tabla} SET cantidad = ? WHERE id = ?`).bind(cantidad, id).run();
    return json({ ok: true });
  }

  if (method === 'DELETE') {
    const id = url.searchParams.get('id');
    if (!id) return json({ error: 'Falta el parámetro id.' }, 400);
    await env.RENDICIONES_DB.prepare(`DELETE FROM ${tabla} WHERE id = ?`).bind(id).run();
    return json({ ok: true });
  }

  return json({ error: 'Método no permitido.' }, 405);
}
