/**
 * Cloudflare Pages Function — /api/mayoristas-remito
 *
 * El remito ABIERTO de un cliente mayorista: líneas sueltas sin número de
 * remito todavía, hasta que se decide "Cerrar remito".
 *
 *   ?cliente_id=   obligatorio en casi todos los métodos
 *
 * GET    ?cliente_id=                → líneas del remito abierto + info del
 *        cliente (nombre, lista asignada con sus productos habilitados) +
 *        último remito cerrado (número y fecha)
 * POST   ?cliente_id=                → agregar línea { producto_id, cantidad, precio_unitario? }
 *        (si no mandás precio_unitario, se usa el de la última publicación
 *        de Mayoristas / el precio en vivo de la receta)
 * PUT    ?id=                        → editar una línea { cantidad?, precio_unitario?, enviado?, recibido?, pagado?, observaciones? }
 * DELETE ?id=                        → quitar una línea del remito abierto
 *
 * POST   ?cliente_id=&accion=cerrar  → cierra el remito: copia todas las
 *        líneas actuales a mayoristas_remitos_cerrados con el próximo N° de
 *        remito de ese cliente y la fecha de hoy, vacía el remito abierto,
 *        y avanza el contador del cliente.
 *
 * Requiere el binding D1: RENDICIONES_DB. Acceso: dueño/supervisor.
 */

import { obtenerSesion, tieneRol } from '../lib/session.js';
import { obtenerPrecioMayorista, listarProductosConTotales } from '../lib/recetas-calc.js';

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

function conSubtotal(linea) {
  return { ...linea, subtotal: Math.round(linea.cantidad * linea.precio_unitario * 100) / 100 };
}

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method.toUpperCase();
  const url = new URL(request.url);
  const clienteId = url.searchParams.get('cliente_id');
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

  // ── CERRAR REMITO ─────────────────────────────────────────────
  if (method === 'POST' && accion === 'cerrar') {
    if (!clienteId) return json({ error: 'Falta el parámetro cliente_id.' }, 400);
    const cliente = await db.prepare('SELECT * FROM mayoristas_clientes WHERE id = ?').bind(clienteId).first();
    if (!cliente) return json({ error: 'Cliente no encontrado.' }, 404);

    const { results: lineas } = await db.prepare('SELECT * FROM mayoristas_remito_lineas WHERE cliente_id = ?').bind(clienteId).all();
    if (lineas.length === 0) return json({ error: 'El remito está vacío — agregá al menos un producto antes de cerrarlo.' }, 400);

    const numero = cliente.proximo_remito_numero;
    const hoy = new Date().toISOString().slice(0, 10);
    const ahora = new Date().toISOString();

    const ops = [
      ...lineas.map(l =>
        db.prepare(
          `INSERT INTO mayoristas_remitos_cerrados
           (id, cliente_id, cliente_nombre, remito_numero, fecha, producto_id, nombre_producto, precio_unitario, cantidad, enviado, recibido, pagado, observaciones, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          crypto.randomUUID(), clienteId, cliente.nombre, numero, hoy,
          l.producto_id, l.nombre_producto, l.precio_unitario, l.cantidad,
          l.enviado, l.recibido, l.pagado, l.observaciones || '', ahora
        )
      ),
      db.prepare('DELETE FROM mayoristas_remito_lineas WHERE cliente_id = ?').bind(clienteId),
      db.prepare('UPDATE mayoristas_clientes SET proximo_remito_numero = ? WHERE id = ?').bind(numero + 1, clienteId),
    ];
    await db.batch(ops);

    return json({ ok: true, remito_numero: numero, fecha: hoy, lineas: lineas.length });
  }

  // ── GET remito abierto + contexto del cliente ────────────────
  if (method === 'GET') {
    if (!clienteId) return json({ error: 'Falta el parámetro cliente_id.' }, 400);
    const cliente = await db.prepare(
      `SELECT c.*, l.nombre as lista_nombre FROM mayoristas_clientes c
       LEFT JOIN mayoristas_listas l ON l.id = c.lista_id WHERE c.id = ?`
    ).bind(clienteId).first();
    if (!cliente) return json({ error: 'Cliente no encontrado.' }, 404);

    const { results: lineasRaw } = await db.prepare(
      'SELECT * FROM mayoristas_remito_lineas WHERE cliente_id = ? ORDER BY created_at'
    ).bind(clienteId).all();
    const lineas = lineasRaw.map(conSubtotal);

    // Catálogo habilitado para este cliente (productos de su lista asignada,
    // con el precio actual de Mayoristas como referencia)
    let catalogo = [];
    if (cliente.lista_id) {
      const { results: idsLista } = await db.prepare(
        'SELECT producto_id FROM mayoristas_listas_productos WHERE lista_id = ?'
      ).bind(cliente.lista_id).all();
      const idsPermitidos = new Set(idsLista.map(r => r.producto_id));
      if (idsPermitidos.size > 0) {
        const productos = await listarProductosConTotales(db);
        catalogo = await Promise.all(
          productos
            .filter(p => idsPermitidos.has(p.id) && p.activo !== 0)
            .map(async p => ({ id: p.id, nombre: p.nombre, precio: await obtenerPrecioMayorista(db, p.id) }))
        );
      }
    }

    const ultimo = await db.prepare(
      'SELECT remito_numero, fecha FROM mayoristas_remitos_cerrados WHERE cliente_id = ? ORDER BY created_at DESC LIMIT 1'
    ).bind(clienteId).first();

    return json({
      ok: true,
      cliente,
      catalogo,
      lineas,
      total: Math.round(lineas.reduce((s, l) => s + l.subtotal, 0) * 100) / 100,
      ultimo_remito: ultimo || null,
    });
  }

  // ── AGREGAR LÍNEA ─────────────────────────────────────────────
  if (method === 'POST') {
    if (!clienteId) return json({ error: 'Falta el parámetro cliente_id.' }, 400);
    let body;
    try { body = await request.json(); } catch { return json({ error: 'Body inválido.' }, 400); }

    const productoId = body.producto_id;
    if (!productoId) return json({ error: 'Falta producto_id.' }, 400);
    const cantidad = Number(body.cantidad);
    if (!(cantidad > 0)) return json({ error: 'La cantidad tiene que ser mayor a 0.' }, 400);

    const producto = await db.prepare('SELECT nombre FROM recetas_productos WHERE id = ?').bind(productoId).first();
    if (!producto) return json({ error: 'Producto no encontrado.' }, 404);

    const precioUnitario = body.precio_unitario !== undefined && body.precio_unitario !== null && body.precio_unitario !== ''
      ? Number(body.precio_unitario) || 0
      : await obtenerPrecioMayorista(db, productoId);

    const nuevoId = crypto.randomUUID();
    await db.prepare(
      `INSERT INTO mayoristas_remito_lineas (id, cliente_id, producto_id, nombre_producto, precio_unitario, cantidad, enviado, recibido, pagado, observaciones, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, '', ?)`
    ).bind(nuevoId, clienteId, productoId, producto.nombre, precioUnitario, cantidad, new Date().toISOString()).run();

    return json({ ok: true, id: nuevoId });
  }

  // ── EDITAR LÍNEA ──────────────────────────────────────────────
  if (method === 'PUT') {
    if (!id) return json({ error: 'Falta el parámetro id.' }, 400);
    const existente = await db.prepare('SELECT * FROM mayoristas_remito_lineas WHERE id = ?').bind(id).first();
    if (!existente) return json({ error: 'Línea no encontrada.' }, 404);

    let body;
    try { body = await request.json(); } catch { return json({ error: 'Body inválido.' }, 400); }

    const cantidad = body.cantidad !== undefined ? Number(body.cantidad) || 0 : existente.cantidad;
    const precio = body.precio_unitario !== undefined ? Number(body.precio_unitario) || 0 : existente.precio_unitario;
    const enviado = body.enviado !== undefined ? (body.enviado ? 1 : 0) : existente.enviado;
    const recibido = body.recibido !== undefined ? (body.recibido ? 1 : 0) : existente.recibido;
    const pagado = body.pagado !== undefined ? (body.pagado ? 1 : 0) : existente.pagado;
    const observaciones = body.observaciones !== undefined ? String(body.observaciones) : existente.observaciones;

    await db.prepare(
      'UPDATE mayoristas_remito_lineas SET cantidad=?, precio_unitario=?, enviado=?, recibido=?, pagado=?, observaciones=? WHERE id=?'
    ).bind(cantidad, precio, enviado, recibido, pagado, observaciones, id).run();
    return json({ ok: true });
  }

  // ── QUITAR LÍNEA ──────────────────────────────────────────────
  if (method === 'DELETE') {
    if (!id) return json({ error: 'Falta el parámetro id.' }, 400);
    await db.prepare('DELETE FROM mayoristas_remito_lineas WHERE id = ?').bind(id).run();
    return json({ ok: true });
  }

  return json({ error: 'Método no permitido.' }, 405);
}
