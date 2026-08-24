/**
 * Cloudflare Pages Function — /api/obligaciones-archivos
 *
 * Historial de cargas de Obligaciones, con posibilidad de deshacer cada
 * una por separado (las veces que haga falta) — por ejemplo si se subió
 * un resumen con el banco equivocado seleccionado.
 *
 * GET    /api/obligaciones-archivos          → listar (últimas 30 cargas)
 * DELETE /api/obligaciones-archivos?id=      → deshacer: borra todos los
 *          movimientos que vinieron de esa carga y libera el archivo para
 *          poder volver a subirlo.
 *
 * Requiere el binding D1: RENDICIONES_DB
 */

import { obtenerSesion, tieneRol } from '../lib/session.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
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

  if (method === 'GET') {
    const { results } = await env.RENDICIONES_DB
      .prepare('SELECT * FROM obligaciones_archivos ORDER BY created_at DESC LIMIT 30')
      .all();
    return json({ ok: true, archivos: results });
  }

  if (method === 'DELETE') {
    const id = url.searchParams.get('id');
    if (!id) return json({ error: 'Falta el parámetro id.' }, 400);

    const archivo = await env.RENDICIONES_DB.prepare('SELECT * FROM obligaciones_archivos WHERE id = ?').bind(id).first();
    if (!archivo) return json({ error: 'Esa carga no existe (puede que ya la hayan deshecho).' }, 404);

    const { meta } = await env.RENDICIONES_DB.prepare('DELETE FROM obligaciones_movimientos WHERE archivo_id = ?').bind(id).run();
    await env.RENDICIONES_DB.prepare('DELETE FROM obligaciones_archivos WHERE id = ?').bind(id).run();

    return json({ ok: true, archivo: archivo.nombre_archivo, filasEliminadas: meta.changes || 0 });
  }

  return json({ error: 'Método no permitido.' }, 405);
}
