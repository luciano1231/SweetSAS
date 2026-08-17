/**
 * Cloudflare Pages Function — /api/empleados
 *
 * GET    /api/empleados?local=<id>          → listar empleados activos de un local (público,
 *                                              lo necesita cualquier usuario logueado para
 *                                              poblar el desplegable de Carga de Rendición)
 * POST   /api/empleados?action=create        → crear (admin, X-Admin-Token)
 * PUT    /api/empleados?id=<id>               → editar nombre / activo (admin)
 * DELETE /api/empleados?id=<id>               → eliminar (admin)
 *
 * Requiere el binding D1: RENDICIONES_DB (misma base que /api/rendiciones)
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
};

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

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method.toUpperCase();
  const url = new URL(request.url);

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (!env.RENDICIONES_DB) {
    return json({ error: 'Binding D1 "RENDICIONES_DB" no encontrado.' }, 500);
  }

  // ── LISTAR (público — lo necesita el formulario de carga) ─────
  if (method === 'GET') {
    const local = url.searchParams.get('local');
    const admin = isAdmin(request, env);

    let sql = 'SELECT * FROM empleados WHERE 1=1';
    const binds = [];
    if (local) { sql += ' AND local_id = ?'; binds.push(local); }
    // Los usuarios normales (formulario de carga) solo ven activos;
    // el panel de administración pide con el token y ve también los inactivos.
    if (!admin) sql += ' AND activo = 1';
    sql += ' ORDER BY nombre COLLATE NOCASE';

    const stmt = binds.length ? env.RENDICIONES_DB.prepare(sql).bind(...binds) : env.RENDICIONES_DB.prepare(sql);
    const { results } = await stmt.all();
    return json({ ok: true, empleados: results });
  }

  // ── A partir de acá, todo requiere el token de administración ──
  if (!isAdmin(request, env)) {
    return json({ error: 'No autorizado.' }, 401);
  }

  // ── CREAR ────────────────────────────────────────────────────
  if (method === 'POST' && url.searchParams.get('action') === 'create') {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Body inválido.' }, 400);
    }

    const { local_id, nombre } = body;
    if (!local_id || !nombre) {
      return json({ error: 'Faltan campos: local_id y nombre son requeridos.' }, 400);
    }

    const id = crypto.randomUUID();
    await env.RENDICIONES_DB.prepare(
      'INSERT INTO empleados (id, local_id, nombre, activo, created_at) VALUES (?, ?, ?, 1, ?)'
    ).bind(id, String(local_id), String(nombre).trim(), new Date().toISOString()).run();

    return json({ ok: true, id });
  }

  // ── EDITAR ───────────────────────────────────────────────────
  if (method === 'PUT') {
    const id = url.searchParams.get('id');
    if (!id) return json({ error: 'Falta el parámetro id.' }, 400);

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Body inválido.' }, 400);
    }

    if (body.nombre) {
      await env.RENDICIONES_DB.prepare('UPDATE empleados SET nombre = ? WHERE id = ?')
        .bind(String(body.nombre).trim(), id).run();
    }
    if (typeof body.activo === 'boolean') {
      await env.RENDICIONES_DB.prepare('UPDATE empleados SET activo = ? WHERE id = ?')
        .bind(body.activo ? 1 : 0, id).run();
    }

    return json({ ok: true });
  }

  // ── ELIMINAR ─────────────────────────────────────────────────
  if (method === 'DELETE') {
    const id = url.searchParams.get('id');
    if (!id) return json({ error: 'Falta el parámetro id.' }, 400);
    await env.RENDICIONES_DB.prepare('DELETE FROM empleados WHERE id = ?').bind(id).run();
    return json({ ok: true });
  }

  return json({ error: 'Método no permitido.' }, 405);
}
