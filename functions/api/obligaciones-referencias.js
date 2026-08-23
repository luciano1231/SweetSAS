/**
 * Cloudflare Pages Function — /api/obligaciones-referencias
 *
 * Gestiona las dos tablas de referencia de Obligaciones:
 *   ?tipo=banco   → obligaciones_referencias_banco   (dato_buscar -> obligacion, reglas de clasificación)
 *   ?tipo=general → obligaciones_referencias_generales (obligacion -> clasificacion, para resúmenes visuales)
 *
 * GET    ?tipo=banco|general               → listar
 * POST   ?tipo=banco|general               → crear
 * PUT    ?tipo=banco|general&id=           → editar
 * DELETE ?tipo=banco|general&id=           → eliminar
 *
 * Requiere el binding D1: RENDICIONES_DB
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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
  const tipo = url.searchParams.get('tipo');

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (!env.RENDICIONES_DB) {
    return json({ error: 'Binding D1 "RENDICIONES_DB" no encontrado. Ver wrangler.jsonc.' }, 500);
  }
  if (tipo !== 'banco' && tipo !== 'general') {
    return json({ error: 'Falta o es inválido el parámetro tipo (banco | general).' }, 400);
  }

  const tabla = tipo === 'banco' ? 'obligaciones_referencias_banco' : 'obligaciones_referencias_generales';
  const campos = tipo === 'banco' ? ['dato_buscar', 'obligacion'] : ['obligacion', 'clasificacion'];
  const orden = tipo === 'banco' ? 'dato_buscar' : 'obligacion';

  if (method === 'GET') {
    const { results } = await env.RENDICIONES_DB.prepare(`SELECT * FROM ${tabla} ORDER BY ${orden} COLLATE NOCASE`).all();
    return json({ ok: true, referencias: results });
  }

  if (method === 'POST') {
    let body;
    try { body = await request.json(); } catch { return json({ error: 'Body inválido.' }, 400); }

    const valores = campos.map(c => (body[c] !== undefined ? String(body[c]).trim() : ''));
    if (!valores[0]) {
      return json({ error: `Falta el campo: ${campos[0]}` }, 400);
    }

    try {
      await env.RENDICIONES_DB
        .prepare(`INSERT INTO ${tabla} (id, ${campos.join(', ')}) VALUES (?, ${campos.map(() => '?').join(', ')})`)
        .bind(crypto.randomUUID(), ...valores)
        .run();
    } catch (e) {
      if (String(e.message).includes('UNIQUE')) {
        return json({ error: `Ya existe un registro con ese ${campos[0] === 'dato_buscar' ? 'dato a buscar' : 'nombre'}.` }, 400);
      }
      throw e;
    }

    return json({ ok: true });
  }

  if (method === 'PUT') {
    const id = url.searchParams.get('id');
    if (!id) return json({ error: 'Falta el parámetro id.' }, 400);

    let body;
    try { body = await request.json(); } catch { return json({ error: 'Body inválido.' }, 400); }

    const sets = [];
    const binds = [];
    campos.forEach(c => {
      if (body[c] !== undefined) { sets.push(`${c} = ?`); binds.push(String(body[c]).trim()); }
    });
    if (sets.length === 0) return json({ error: 'Nada para actualizar.' }, 400);

    binds.push(id);
    try {
      await env.RENDICIONES_DB.prepare(`UPDATE ${tabla} SET ${sets.join(', ')} WHERE id = ?`).bind(...binds).run();
    } catch (e) {
      if (String(e.message).includes('UNIQUE')) {
        return json({ error: 'Ya existe otro registro con ese valor.' }, 400);
      }
      throw e;
    }

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
