/**
 * Cloudflare Pages Function — /api/obligaciones-upload
 *
 * POST /api/obligaciones-upload   (multipart/form-data)
 *   campos: archivo (File), banco ('GALICIA' | 'MERCADOPAGO')
 *
 * Reemplaza el flujo de "subir a una carpeta de Drive + trigger horario":
 * el cliente sube el resumen (CSV o Excel, cualquiera de los dos para
 * cualquier banco) directo desde el navegador, se clasifica al toque con
 * las reglas de Referencias Banco + lo aprendido, y se inserta en
 * obligaciones_movimientos evitando duplicados (por archivo y por fila).
 *
 * Requiere el binding D1: RENDICIONES_DB
 */

import {
  tipoDeArchivo, leerArchivoComoArray, extraerFilasGalicia, extraerFilasMercadoPago,
  agruparItems, clasificarFilas, fechaISO, fingerprintDe,
} from '../lib/obligaciones-core.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

async function sha256Hex(buffer) {
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method.toUpperCase();

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (method !== 'POST') {
    return json({ error: 'Método no permitido.' }, 405);
  }
  if (!env.RENDICIONES_DB) {
    return json({ error: 'Binding D1 "RENDICIONES_DB" no encontrado. Ver wrangler.jsonc.' }, 500);
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ error: 'No se pudo leer el archivo enviado.' }, 400);
  }

  const archivo = form.get('archivo');
  const banco = String(form.get('banco') || '').toUpperCase();

  if (!archivo || typeof archivo.arrayBuffer !== 'function') {
    return json({ error: 'Falta el archivo a procesar.' }, 400);
  }
  if (banco !== 'GALICIA' && banco !== 'MERCADOPAGO') {
    return json({ error: 'Banco inválido. Debe ser GALICIA o MERCADOPAGO.' }, 400);
  }

  const tipo = tipoDeArchivo(archivo.name, archivo.type);
  if (!tipo) {
    return json({ error: `'${archivo.name}' no es un CSV ni un Excel reconocible.` }, 400);
  }

  const buffer = await archivo.arrayBuffer();

  // ── Deduplicación por archivo (hash del contenido) ──────────────
  const fingerprintArchivo = await sha256Hex(buffer);
  const yaExiste = await env.RENDICIONES_DB
    .prepare('SELECT id, nombre_archivo, created_at FROM obligaciones_archivos WHERE fingerprint = ?')
    .bind(fingerprintArchivo)
    .first();

  if (yaExiste) {
    return json({
      error: `Este archivo ya fue procesado antes (${yaExiste.nombre_archivo}, el ${new Date(yaExiste.created_at).toLocaleDateString('es-AR')}). No se volvió a cargar para evitar duplicados.`,
      duplicado: true,
    }, 409);
  }

  // ── Parsear y extraer filas ──────────────────────────────────────
  let datos, filas;
  try {
    datos = leerArchivoComoArray(buffer, tipo);
    filas = (banco === 'GALICIA') ? extraerFilasGalicia(datos) : extraerFilasMercadoPago(datos);
  } catch (e) {
    return json({ error: `No se pudo leer el archivo: ${e.message}` }, 400);
  }

  if (filas.length === 0) {
    return json({ error: 'El archivo no contenía movimientos válidos para procesar.' }, 400);
  }

  filas = agruparItems(filas);

  // ── Cargar reglas de clasificación + memoria aprendida ───────────
  const referencias = await cargarReferenciasBanco(env);
  const aprendizaje = await cargarAprendizaje(env);
  const filasClasificadas = clasificarFilas(filas, referencias, aprendizaje);

  // ── Deduplicación por fila (acotada al rango de fechas del archivo) ──
  const fechasValidas = filasClasificadas.filter(f => f.fecha instanceof Date && !isNaN(f.fecha.getTime()));
  if (fechasValidas.length === 0) {
    return json({ error: 'Ninguna fila del archivo tenía una fecha válida.' }, 400);
  }
  const fechaMin = fechaISO(new Date(Math.min(...fechasValidas.map(f => f.fecha.getTime()))));
  const fechaMax = fechaISO(new Date(Math.max(...fechasValidas.map(f => f.fecha.getTime()))));

  const { results: existentes } = await env.RENDICIONES_DB
    .prepare('SELECT fecha, monto, observacion FROM obligaciones_movimientos WHERE fecha BETWEEN ? AND ?')
    .bind(fechaMin, fechaMax)
    .all();

  const fingerprints = new Set(existentes.map(r => `${r.fecha}|${r.monto}|${r.observacion}`));

  const nombreBanco = banco === 'GALICIA' ? 'Banco Galicia' : 'Mercado Pago';
  const ahora = new Date().toISOString();
  const archivoId = crypto.randomUUID(); // identifica esta carga puntual, para poder deshacerla entera
  const stmts = [];
  const categoriasNuevas = new Set();
  let insertadas = 0;
  let duplicadasOmitidas = 0;
  let sinClasificar = 0;

  fechasValidas.forEach(fila => {
    const fp = fingerprintDe(fila);
    if (fingerprints.has(fp)) { duplicadasOmitidas++; return; }
    fingerprints.add(fp);

    if (fila.categoria === 'SIN CLASIFICAR') sinClasificar++;
    categoriasNuevas.add(fila.categoria);

    stmts.push(env.RENDICIONES_DB.prepare(
      `INSERT INTO obligaciones_movimientos
        (id, fecha, obligacion, de_quien_la_deuda, origen_del_dinero, monto, observacion, banco, archivo_origen, archivo_id, created_at)
       VALUES (?, ?, ?, '', '', ?, ?, ?, ?, ?, ?)`
    ).bind(
      crypto.randomUUID(), fechaISO(fila.fecha), fila.categoria,
      fila.monto, fila.observacion, nombreBanco, archivo.name, archivoId, ahora
    ));
    insertadas++;
  });

  // Registrar el archivo como procesado (aunque haya 0 filas nuevas, para
  // que no se pueda volver a subir por error). Este mismo id es el que
  // permite deshacer la carga completa después.
  stmts.push(env.RENDICIONES_DB.prepare(
    `INSERT INTO obligaciones_archivos (id, fingerprint, nombre_archivo, banco, filas_insertadas, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(archivoId, fingerprintArchivo, archivo.name, nombreBanco, insertadas, ahora));

  if (stmts.length > 0) {
    await env.RENDICIONES_DB.batch(stmts);
  }

  // Alta automática de Obligaciones nuevas en la hoja de clasificación general
  await agregarObligacionesSiFaltan(env, [...categoriasNuevas]);

  return json({
    ok: true,
    archivo: archivo.name,
    banco: nombreBanco,
    filasLeidas: filasClasificadas.length,
    insertadas,
    duplicadasOmitidas,
    sinClasificar,
  });
}

async function cargarReferenciasBanco(env) {
  const { results } = await env.RENDICIONES_DB.prepare('SELECT dato_buscar, obligacion FROM obligaciones_referencias_banco').all();
  const mapa = {};
  results.forEach(r => { mapa[String(r.dato_buscar).toUpperCase()] = r.obligacion; });
  return mapa;
}

async function cargarAprendizaje(env) {
  const { results } = await env.RENDICIONES_DB.prepare('SELECT observacion, obligacion FROM obligaciones_aprendizaje').all();
  const mapa = {};
  results.forEach(r => { mapa[r.observacion] = r.obligacion; });
  return mapa;
}

export async function agregarObligacionesSiFaltan(env, nombres) {
  const validos = [...new Set(nombres.map(n => String(n || '').trim()).filter(n => n && n.toUpperCase() !== 'SIN CLASIFICAR'))];
  if (validos.length === 0) return;

  const stmts = validos.map(n => env.RENDICIONES_DB.prepare(
    `INSERT INTO obligaciones_referencias_generales (id, obligacion, clasificacion)
     VALUES (?, ?, NULL)
     ON CONFLICT(obligacion) DO NOTHING`
  ).bind(crypto.randomUUID(), n));

  await env.RENDICIONES_DB.batch(stmts);
}
