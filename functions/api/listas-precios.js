/**
 * Cloudflare Pages Function — /api/listas-precios
 *
 * Listas de precios "congeladas" para imprimir a clientes o pasarle a
 * mayoristas, armadas a partir de los productos de Recetas.
 *
 *   ?lista=clientes | mayoristas   (obligatorio en casi todos los métodos)
 *
 * GET  ?lista=&modo=borrador    → líneas del borrador de esa lista, con el
 *      precio base tomado EN VIVO de la receta + el precio final ya con el
 *      ajuste de esa línea aplicado.
 * GET  ?lista=&modo=publicada   → última foto publicada (precios fijos) +
 *      fecha de publicación. Si nunca se publicó, publicada: [].
 *
 * POST ?accion=sincronizar  body:{ lista }
 *      → agrega al borrador los productos activos de Recetas que todavía no
 *      estén en él (no toca los que ya estaban, ni sus ajustes).
 * PUT  ?id=<borrador_id>     body:{ ajuste_tipo?, ajuste_valor? }
 *      → edita el ajuste de una línea del borrador.
 * DELETE ?id=<borrador_id>
 *      → saca un producto del borrador de esa lista (no lo borra de Recetas).
 *
 * POST ?accion=publicar  body:{ lista }
 *      → congela el precio final de cada línea del borrador en
 *      listas_precios_publicadas (reemplaza la publicación anterior de esa
 *      lista) y guarda la fecha de publicación.
 *
 * Requiere el binding D1: RENDICIONES_DB. Acceso: dueño/supervisor.
 */

import { obtenerSesion, tieneRol } from '../lib/session.js';
import { listarProductosConTotales, aplicarAjuste } from '../lib/recetas-calc.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const LISTAS_VALIDAS = ['clientes', 'mayoristas'];

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

// Arma las líneas del borrador de una lista con su precio base en vivo
// (o null si el producto ya no existe / no está más activo) y el precio
// final ya calculado.
async function armarBorrador(db, lista) {
  const { results: filas } = await db.prepare(
    'SELECT * FROM listas_precios_borrador WHERE lista = ? ORDER BY nombre_cache COLLATE NOCASE'
  ).bind(lista).all();

  const productos = await listarProductosConTotales(db);
  const mapaProductos = Object.fromEntries(productos.map(p => [p.id, p]));

  return filas.map(f => {
    const producto = mapaProductos[f.producto_id];
    const existe = !!producto;
    const activo = existe && producto.activo !== 0;
    const nombre = existe ? producto.nombre : f.nombre_cache;
    const precioBase = existe ? producto.precio_con_utilidad : null;
    const precioFinal = existe ? aplicarAjuste(precioBase, f.ajuste_tipo, f.ajuste_valor) : null;
    return {
      id: f.id,
      producto_id: f.producto_id,
      nombre,
      existe,
      activo,
      precio_base: precioBase,
      ajuste_tipo: f.ajuste_tipo,
      ajuste_valor: f.ajuste_valor,
      precio_final: precioFinal,
    };
  });
}

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method.toUpperCase();
  const url = new URL(request.url);
  const lista = url.searchParams.get('lista');
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

  // ── GET: borrador o publicada ────────────────────────────────
  if (method === 'GET') {
    if (!LISTAS_VALIDAS.includes(lista)) return json({ error: 'Falta o es inválido el parámetro lista (clientes | mayoristas).' }, 400);
    const modo = url.searchParams.get('modo') || 'borrador';

    if (modo === 'publicada') {
      const { results: publicada } = await db.prepare(
        'SELECT producto_id, nombre, precio_final FROM listas_precios_publicadas WHERE lista = ? ORDER BY nombre COLLATE NOCASE'
      ).bind(lista).all();
      const meta = await db.prepare('SELECT published_at FROM listas_precios_meta WHERE lista = ?').bind(lista).first();
      return json({ ok: true, lista, publicada, published_at: meta ? meta.published_at : null });
    }

    const borrador = await armarBorrador(db, lista);
    const meta = await db.prepare('SELECT published_at FROM listas_precios_meta WHERE lista = ?').bind(lista).first();
    return json({ ok: true, lista, borrador, published_at: meta ? meta.published_at : null });
  }

  // ── POST: sincronizar o publicar ─────────────────────────────
  if (method === 'POST' && accion === 'sincronizar') {
    let body;
    try { body = await request.json(); } catch { return json({ error: 'Body inválido.' }, 400); }
    if (!LISTAS_VALIDAS.includes(body.lista)) return json({ error: 'Falta o es inválido el campo lista.' }, 400);

    const productos = await listarProductosConTotales(db);
    const activos = productos.filter(p => p.activo !== 0);

    const { results: yaEnBorrador } = await db.prepare(
      'SELECT producto_id FROM listas_precios_borrador WHERE lista = ?'
    ).bind(body.lista).all();
    const idsExistentes = new Set(yaEnBorrador.map(r => r.producto_id));

    const nuevos = activos.filter(p => !idsExistentes.has(p.id));
    if (nuevos.length === 0) return json({ ok: true, agregados: 0 });

    const ahora = new Date().toISOString();
    const inserts = nuevos.map(p =>
      db.prepare(
        'INSERT INTO listas_precios_borrador (id, lista, producto_id, nombre_cache, ajuste_tipo, ajuste_valor, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(crypto.randomUUID(), body.lista, p.id, p.nombre, 'monto', 0, ahora)
    );
    await db.batch(inserts);

    return json({ ok: true, agregados: nuevos.length });
  }

  if (method === 'POST' && accion === 'publicar') {
    let body;
    try { body = await request.json(); } catch { return json({ error: 'Body inválido.' }, 400); }
    if (!LISTAS_VALIDAS.includes(body.lista)) return json({ error: 'Falta o es inválido el campo lista.' }, 400);

    const lineas = await armarBorrador(db, body.lista);
    const publicables = lineas.filter(l => l.existe);
    if (publicables.length === 0) return json({ error: 'El borrador está vacío — sincronizá antes de publicar.' }, 400);

    const ahora = new Date().toISOString();
    const ops = [
      db.prepare('DELETE FROM listas_precios_publicadas WHERE lista = ?').bind(body.lista),
      ...publicables.map(l =>
        db.prepare('INSERT INTO listas_precios_publicadas (id, lista, producto_id, nombre, precio_final) VALUES (?, ?, ?, ?, ?)')
          .bind(crypto.randomUUID(), body.lista, l.producto_id, l.nombre, l.precio_final)
      ),
      db.prepare('INSERT INTO listas_precios_meta (lista, published_at) VALUES (?, ?) ON CONFLICT(lista) DO UPDATE SET published_at = excluded.published_at')
        .bind(body.lista, ahora),
    ];
    await db.batch(ops);

    return json({ ok: true, publicados: publicables.length, published_at: ahora });
  }

  // ── PUT: editar ajuste de una línea del borrador ─────────────
  if (method === 'PUT') {
    if (!id) return json({ error: 'Falta el parámetro id.' }, 400);
    const existente = await db.prepare('SELECT * FROM listas_precios_borrador WHERE id = ?').bind(id).first();
    if (!existente) return json({ error: 'Línea no encontrada.' }, 404);

    let body;
    try { body = await request.json(); } catch { return json({ error: 'Body inválido.' }, 400); }

    const ajusteTipo = body.ajuste_tipo !== undefined ? body.ajuste_tipo : existente.ajuste_tipo;
    if (!['monto', 'porcentaje'].includes(ajusteTipo)) return json({ error: 'ajuste_tipo debe ser "monto" o "porcentaje".' }, 400);
    const ajusteValor = body.ajuste_valor !== undefined ? Number(body.ajuste_valor) || 0 : existente.ajuste_valor;

    await db.prepare('UPDATE listas_precios_borrador SET ajuste_tipo = ?, ajuste_valor = ? WHERE id = ?')
      .bind(ajusteTipo, ajusteValor, id).run();
    return json({ ok: true });
  }

  // ── DELETE: sacar un producto del borrador ───────────────────
  if (method === 'DELETE') {
    if (!id) return json({ error: 'Falta el parámetro id.' }, 400);
    await db.prepare('DELETE FROM listas_precios_borrador WHERE id = ?').bind(id).run();
    return json({ ok: true });
  }

  return json({ error: 'Método no permitido.' }, 405);
}
