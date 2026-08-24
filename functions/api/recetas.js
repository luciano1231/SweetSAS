/**
 * Cloudflare Pages Function — /api/recetas
 *
 * GET    /api/recetas              → listar productos con costo/precio calculados
 * GET    /api/recetas?id=          → detalle de un producto: resumen + líneas
 *          de ingredientes y costos fijos (con costo por unidad EN VIVO desde
 *          el catálogo — si cambia el costo de un ingrediente, se refleja
 *          solo, sin tener que re-guardar la receta)
 * POST   /api/recetas              → crear producto { nombre, unidades_por_tanda?, utilidad_deseada_pct?, observaciones?, receta_texto? }
 * PUT    /api/recetas?id=          → editar producto (mismos campos, + activo? para habilitar/deshabilitar)
 * DELETE /api/recetas?id=          → eliminar producto (y sus líneas)
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

function calcularTotales(producto, totalIngredientes, totalCostosFijos) {
  const costoTotal = Math.round((totalIngredientes + totalCostosFijos) * 100) / 100;
  const unidades = Number(producto.unidades_por_tanda) || 1;
  const costoUnitario = Math.round((costoTotal / unidades) * 100) / 100;
  const utilidadPct = Number(producto.utilidad_deseada_pct) || 0;
  const precioConUtilidad = Math.round(costoUnitario * (1 + utilidadPct / 100) * 100) / 100;
  return { costo_total: costoTotal, costo_unitario: costoUnitario, precio_con_utilidad: precioConUtilidad };
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

  // ── DETALLE de un producto ───────────────────────────────────
  if (method === 'GET' && id) {
    const producto = await env.RENDICIONES_DB.prepare('SELECT * FROM recetas_productos WHERE id = ?').bind(id).first();
    if (!producto) return json({ error: 'Producto no encontrado.' }, 404);

    const { results: ingredientes } = await env.RENDICIONES_DB.prepare(
      `SELECT pi.id, pi.cantidad, i.id as ingrediente_id, i.nombre, i.costo_fraccion
       FROM recetas_producto_ingredientes pi
       JOIN recetas_ingredientes i ON i.id = pi.ingrediente_id
       WHERE pi.producto_id = ? ORDER BY i.nombre COLLATE NOCASE`
    ).bind(id).all();

    const { results: costosFijos } = await env.RENDICIONES_DB.prepare(
      `SELECT pc.id, pc.cantidad, c.id as costo_fijo_id, c.nombre, c.costo_fraccion
       FROM recetas_producto_costos_fijos pc
       JOIN recetas_costos_fijos c ON c.id = pc.costo_fijo_id
       WHERE pc.producto_id = ? ORDER BY c.nombre COLLATE NOCASE`
    ).bind(id).all();

    const conSubtotal = (rows) => rows.map(r => ({ ...r, subtotal: Math.round(r.cantidad * r.costo_fraccion * 100) / 100 }));
    const lineasIngredientes = conSubtotal(ingredientes);
    const lineasCostosFijos = conSubtotal(costosFijos);

    const totalIngredientes = lineasIngredientes.reduce((s, r) => s + r.subtotal, 0);
    const totalCostosFijos = lineasCostosFijos.reduce((s, r) => s + r.subtotal, 0);
    const totales = calcularTotales(producto, totalIngredientes, totalCostosFijos);

    return json({
      ok: true,
      producto,
      ingredientes: lineasIngredientes.map(r => ({ ...r, porcentaje: totalIngredientes > 0 ? Math.round((r.subtotal / totalIngredientes) * 1000) / 10 : 0 })),
      costosFijos: lineasCostosFijos.map(r => ({ ...r, porcentaje: totalCostosFijos > 0 ? Math.round((r.subtotal / totalCostosFijos) * 1000) / 10 : 0 })),
      totalIngredientes: Math.round(totalIngredientes * 100) / 100,
      totalCostosFijos: Math.round(totalCostosFijos * 100) / 100,
      ...totales,
    });
  }

  // ── LISTAR productos (con totales calculados) ────────────────
  if (method === 'GET') {
    const { results: productos } = await env.RENDICIONES_DB.prepare('SELECT * FROM recetas_productos ORDER BY nombre COLLATE NOCASE').all();

    const { results: sumasIng } = await env.RENDICIONES_DB.prepare(
      `SELECT pi.producto_id, SUM(pi.cantidad * i.costo_fraccion) as total
       FROM recetas_producto_ingredientes pi JOIN recetas_ingredientes i ON i.id = pi.ingrediente_id
       GROUP BY pi.producto_id`
    ).all();
    const { results: sumasCF } = await env.RENDICIONES_DB.prepare(
      `SELECT pc.producto_id, SUM(pc.cantidad * c.costo_fraccion) as total
       FROM recetas_producto_costos_fijos pc JOIN recetas_costos_fijos c ON c.id = pc.costo_fijo_id
       GROUP BY pc.producto_id`
    ).all();

    const mapaIng = Object.fromEntries(sumasIng.map(r => [r.producto_id, r.total || 0]));
    const mapaCF = Object.fromEntries(sumasCF.map(r => [r.producto_id, r.total || 0]));

    const conTotales = productos.map(p => ({
      ...p,
      ...calcularTotales(p, mapaIng[p.id] || 0, mapaCF[p.id] || 0),
    }));

    return json({ ok: true, productos: conTotales });
  }

  // ── CREAR ─────────────────────────────────────────────────────
  if (method === 'POST') {
    let body;
    try { body = await request.json(); } catch { return json({ error: 'Body inválido.' }, 400); }

    const nombre = (body.nombre || '').toString().trim();
    if (!nombre) return json({ error: 'Falta el campo: nombre' }, 400);

    const ahora = new Date().toISOString();
    const nuevoId = crypto.randomUUID();

    try {
      await env.RENDICIONES_DB.prepare(
        `INSERT INTO recetas_productos (id, nombre, unidades_por_tanda, utilidad_deseada_pct, observaciones, receta_texto, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        nuevoId, nombre,
        Number(body.unidades_por_tanda) || 1,
        body.utilidad_deseada_pct !== undefined ? Number(body.utilidad_deseada_pct) || 0 : 50,
        body.observaciones ? String(body.observaciones).trim() : '',
        body.receta_texto ? String(body.receta_texto) : '',
        ahora, ahora
      ).run();
    } catch (e) {
      if (String(e.message).includes('UNIQUE')) return json({ error: 'Ya existe un producto con ese nombre.' }, 400);
      throw e;
    }

    return json({ ok: true, id: nuevoId });
  }

  // ── EDITAR ────────────────────────────────────────────────────
  if (method === 'PUT') {
    if (!id) return json({ error: 'Falta el parámetro id.' }, 400);
    const existente = await env.RENDICIONES_DB.prepare('SELECT * FROM recetas_productos WHERE id = ?').bind(id).first();
    if (!existente) return json({ error: 'Producto no encontrado.' }, 404);

    let body;
    try { body = await request.json(); } catch { return json({ error: 'Body inválido.' }, 400); }

    const nombre = body.nombre !== undefined ? String(body.nombre).trim() : existente.nombre;
    const unidades = body.unidades_por_tanda !== undefined ? Number(body.unidades_por_tanda) || 1 : existente.unidades_por_tanda;
    const utilidad = body.utilidad_deseada_pct !== undefined ? Number(body.utilidad_deseada_pct) || 0 : existente.utilidad_deseada_pct;
    const observaciones = body.observaciones !== undefined ? String(body.observaciones).trim() : existente.observaciones;
    const recetaTexto = body.receta_texto !== undefined ? String(body.receta_texto) : existente.receta_texto;
    const activo = body.activo !== undefined ? (body.activo ? 1 : 0) : existente.activo;

    try {
      await env.RENDICIONES_DB.prepare(
        `UPDATE recetas_productos SET nombre=?, unidades_por_tanda=?, utilidad_deseada_pct=?, observaciones=?, receta_texto=?, activo=?, updated_at=? WHERE id=?`
      ).bind(nombre, unidades, utilidad, observaciones, recetaTexto, activo, new Date().toISOString(), id).run();
    } catch (e) {
      if (String(e.message).includes('UNIQUE')) return json({ error: 'Ya existe otro producto con ese nombre.' }, 400);
      throw e;
    }

    return json({ ok: true });
  }

  // ── ELIMINAR (cascada a sus líneas) ──────────────────────────
  if (method === 'DELETE') {
    if (!id) return json({ error: 'Falta el parámetro id.' }, 400);
    await env.RENDICIONES_DB.batch([
      env.RENDICIONES_DB.prepare('DELETE FROM recetas_producto_ingredientes WHERE producto_id = ?').bind(id),
      env.RENDICIONES_DB.prepare('DELETE FROM recetas_producto_costos_fijos WHERE producto_id = ?').bind(id),
      env.RENDICIONES_DB.prepare('DELETE FROM recetas_productos WHERE id = ?').bind(id),
    ]);
    return json({ ok: true });
  }

  return json({ error: 'Método no permitido.' }, 405);
}
