/**
 * Cloudflare Pages Function — /api/recetas-catalogo
 *
 * Catálogo de ingredientes y de costos fijos (mano de obra, alquiler,
 * energía, etc.) — la base sobre la que se arman las recetas.
 *
 *   ?tipo=ingrediente | costofijo
 *
 * GET    ?tipo=...                → listar
 * POST   ?tipo=...                → crear { nombre, costo_bulto, cantidad_bulto, observaciones }
 * PUT    ?tipo=...&id=            → actualizar costo ("ACTUALIZAR COSTO" de la planilla).
 *        fecha_actualizacion es un campo más (no se pisa sola): si no se
 *        manda, se conserva la que ya tenía.
 * DELETE ?tipo=...&id=            → eliminar (solo si ninguna receta lo usa)
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

function costoFraccion(costoBulto, cantidadBulto) {
  const cb = Number(costoBulto) || 0;
  const cant = Number(cantidadBulto) || 0;
  return cant > 0 ? Math.round((cb / cant) * 100) / 100 : 0;
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

  const tabla = tipo === 'ingrediente' ? 'recetas_ingredientes' : 'recetas_costos_fijos';
  const usoTabla = tipo === 'ingrediente' ? 'recetas_producto_ingredientes' : 'recetas_producto_costos_fijos';
  const usoColumna = tipo === 'ingrediente' ? 'ingrediente_id' : 'costo_fijo_id';

  if (method === 'GET') {
    const { results } = await env.RENDICIONES_DB.prepare(`SELECT * FROM ${tabla} ORDER BY nombre COLLATE NOCASE`).all();
    return json({ ok: true, items: results });
  }

  if (method === 'POST') {
    let body;
    try { body = await request.json(); } catch { return json({ error: 'Body inválido.' }, 400); }

    const nombre = (body.nombre || '').toString().trim();
    if (!nombre) return json({ error: 'Falta el campo: nombre' }, 400);

    const costoBulto = Number(body.costo_bulto) || 0;
    const cantidadBulto = Number(body.cantidad_bulto) || 1;

    try {
      await env.RENDICIONES_DB.prepare(
        `INSERT INTO ${tabla} (id, nombre, costo_bulto, cantidad_bulto, costo_fraccion, fecha_actualizacion, observaciones)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        crypto.randomUUID(), nombre, costoBulto, cantidadBulto,
        costoFraccion(costoBulto, cantidadBulto), new Date().toISOString(),
        body.observaciones ? String(body.observaciones).trim() : ''
      ).run();
    } catch (e) {
      if (String(e.message).includes('UNIQUE')) return json({ error: 'Ya existe uno con ese nombre.' }, 400);
      throw e;
    }

    return json({ ok: true });
  }

  if (method === 'PUT') {
    const id = url.searchParams.get('id');
    if (!id) return json({ error: 'Falta el parámetro id.' }, 400);

    const existente = await env.RENDICIONES_DB.prepare(`SELECT * FROM ${tabla} WHERE id = ?`).bind(id).first();
    if (!existente) return json({ error: 'No encontrado.' }, 404);

    let body;
    try { body = await request.json(); } catch { return json({ error: 'Body inválido.' }, 400); }

    const nombre = body.nombre !== undefined ? String(body.nombre).trim() : existente.nombre;
    const costoBulto = body.costo_bulto !== undefined ? Number(body.costo_bulto) || 0 : existente.costo_bulto;
    const cantidadBulto = body.cantidad_bulto !== undefined ? Number(body.cantidad_bulto) || 1 : existente.cantidad_bulto;
    const observaciones = body.observaciones !== undefined ? String(body.observaciones).trim() : existente.observaciones;
    // La fecha ahora la controla quien edita (con un botón "Hoy" en la
    // interfaz) en vez de pisarla sola en cada guardado — si no la mandan,
    // se respeta la que ya tenía.
    const fechaActualizacion = body.fecha_actualizacion !== undefined ? (body.fecha_actualizacion || null) : existente.fecha_actualizacion;

    try {
      await env.RENDICIONES_DB.prepare(
        `UPDATE ${tabla} SET nombre=?, costo_bulto=?, cantidad_bulto=?, costo_fraccion=?, fecha_actualizacion=?, observaciones=? WHERE id=?`
      ).bind(nombre, costoBulto, cantidadBulto, costoFraccion(costoBulto, cantidadBulto), fechaActualizacion, observaciones, id).run();
    } catch (e) {
      if (String(e.message).includes('UNIQUE')) return json({ error: 'Ya existe otro con ese nombre.' }, 400);
      throw e;
    }

    return json({ ok: true });
  }

  if (method === 'DELETE') {
    const id = url.searchParams.get('id');
    if (!id) return json({ error: 'Falta el parámetro id.' }, 400);

    const enUso = await env.RENDICIONES_DB.prepare(`SELECT COUNT(*) as n FROM ${usoTabla} WHERE ${usoColumna} = ?`).bind(id).first();
    if (enUso && enUso.n > 0) {
      return json({ error: `No se puede eliminar: lo usan ${enUso.n} receta${enUso.n !== 1 ? 's' : ''}. Sacalo de esas recetas primero.` }, 400);
    }

    await env.RENDICIONES_DB.prepare(`DELETE FROM ${tabla} WHERE id = ?`).bind(id).run();
    return json({ ok: true });
  }

  return json({ error: 'Método no permitido.' }, 405);
}
