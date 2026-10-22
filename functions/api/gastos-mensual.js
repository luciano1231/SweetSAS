/**
 * Cloudflare Pages Function — /api/gastos-mensual
 *
 * GET /api/gastos-mensual → { ok, mensual: [{ mes, ...columnas }] }
 *
 * Resumen mensual de egresos para el tablero financiero. Junta las dos
 * fuentes del sistema nuevo (Obligaciones + Caja Chica de cada local) y
 * separa cada gasto según su clasificación:
 *
 *   Gastos de empresa → obligaciones, cajaChicaPan/SH/Ch/Prod
 *   Gastos extras     → personales, internos, inversiones
 *                       (no son gasto de la empresa; se muestran aparte)
 *
 * Lo que decide si un gasto es "extra" es la clasificación: la de la caja
 * chica viene en cada movimiento; la de las obligaciones sale de la tabla
 * obligaciones_referencias_generales (Obligación → Clasificación) y, si la
 * obligación no tiene clasificación general, del nombre de la obligación.
 *
 * Requiere el binding D1: RENDICIONES_DB
 */

import { obtenerSesion, tieneRol } from '../lib/session.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

// Reglas de "gasto extra" (se comparan sin acentos ni mayúsculas, por
// fragmento). Lo que no cae en ninguna es gasto de la empresa.
// 'GASTOS EXTRA' es la clasificación de caja chica para cosas no
// empresariales (mascota, veterinaria), por eso va con los personales.
const REGLAS_EXTRA = [
  { col: 'personales', fragmentos: ['PERSONAL', 'GASTOS EXTRA'] },
  { col: 'internos', fragmentos: ['INTERNO', 'INTERNA'] },
  { col: 'inversiones', fragmentos: ['INVERSION'] },
];

// local_id de caja chica → columna del tablero
const CAJA_COL = { rissione: 'cajaChicaPan', hiper: 'cajaChicaSH', changoMas: 'cajaChicaCh', produccion: 'cajaChicaProd' };

const COLUMNAS = ['obligaciones', 'cajaChicaPan', 'cajaChicaSH', 'cajaChicaCh', 'cajaChicaProd', 'personales', 'internos', 'inversiones'];

function normalizar(s) {
  return (s || '').toString().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

function columnaExtra(...textos) {
  const t = textos.map(normalizar).filter(Boolean);
  for (const regla of REGLAS_EXTRA) {
    if (t.some(txt => regla.fragmentos.some(f => txt.includes(f)))) return regla.col;
  }
  return null;
}

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method.toUpperCase();

  if (method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (method !== 'GET') return json({ error: 'Método no permitido.' }, 405);
  if (!env.RENDICIONES_DB) {
    return json({ error: 'Binding D1 "RENDICIONES_DB" no encontrado. Ver wrangler.jsonc.' }, 500);
  }

  // Mismo criterio que Obligaciones y la planilla maestra de Caja Chica:
  // información financiera de todo el negocio, solo dueño y supervisor.
  const session = await obtenerSesion(request, env);
  if (!tieneRol(session, 'owner', 'supervisor')) return json({ error: 'No autorizado.' }, 403);

  const [oblig, caja] = await Promise.all([
    env.RENDICIONES_DB.prepare(
      `SELECT substr(m.fecha, 1, 7) AS mes, m.obligacion, g.clasificacion, SUM(m.monto) AS total
       FROM obligaciones_movimientos m
       LEFT JOIN obligaciones_referencias_generales g ON g.obligacion = m.obligacion
       GROUP BY mes, m.obligacion, g.clasificacion`
    ).all(),
    env.RENDICIONES_DB.prepare(
      `SELECT substr(fecha, 1, 7) AS mes, local_id, clasificacion, SUM(egreso) AS total
       FROM caja_chica_movimientos
       WHERE egreso > 0
       GROUP BY mes, local_id, clasificacion`
    ).all(),
  ]);

  const porMes = new Map();
  const fila = (mes) => {
    if (!porMes.has(mes)) {
      const f = { mes };
      COLUMNAS.forEach(c => { f[c] = 0; });
      porMes.set(mes, f);
    }
    return porMes.get(mes);
  };

  for (const r of oblig.results) {
    if (!r.mes) continue;
    const f = fila(r.mes);
    f[columnaExtra(r.clasificacion, r.obligacion) || 'obligaciones'] += r.total || 0;
  }
  for (const r of caja.results) {
    if (!r.mes) continue;
    const f = fila(r.mes);
    const col = columnaExtra(r.clasificacion) || CAJA_COL[r.local_id];
    if (col) f[col] += r.total || 0;
  }

  const mensual = [...porMes.values()].sort((a, b) => a.mes.localeCompare(b.mes));
  return json({ ok: true, mensual });
}
