/**
 * Cloudflare Pages Function — /api/caja-chica-items
 *
 * Catálogo (editable) de ítems y clasificaciones de Caja Chica. Vive en KV
 * (binding CAJACHICA_DATA, key "catalog") y se siembra con la lista
 * histórica de las planillas Excel la primera vez que se lee.
 *
 * GET    /api/caja-chica-items                          → { clasificaciones, items }
 * POST   /api/caja-chica-items?action=item               → crear ítem { item, clasificacion }
 * PUT    /api/caja-chica-items?action=item&id=            → editar ítem { item?, clasificacion? }
 * DELETE /api/caja-chica-items?action=item&id=            → eliminar ítem
 * POST   /api/caja-chica-items?action=clasificacion       → crear clasificación { nombre }
 * PUT    /api/caja-chica-items?action=clasificacion&nombre=VIEJO → renombrar { nombre: NUEVO } (cascada a los ítems)
 * DELETE /api/caja-chica-items?action=clasificacion&nombre=       → eliminar (solo si no la usa ningún ítem)
 *
 * Sin token de admin aparte: el acceso ya lo filtra el permiso de página
 * (dueño/supervisor) en auth-gate.js, igual que el editor de menú.
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const KV_KEY = 'catalog';

const CLASIFICACIONES_DEFAULT = [
  'MOVIMIENTO INTERNO', 'SUELDOS', 'INGREDIENTES / INSUMOS', 'PROVEEDORES',
  'SERVICIOS', 'MANTENIMIENTO', 'TRANSPORTE', 'LIMPIEZA', 'UTILES DE OFICINA',
  'IMPUESTO', 'GASTOS PERSONALES', 'GASTOS EXTRA',
];

const ITEMS_DEFAULT = [
  ['DEPOSITO A SUB CAJA CHICA', 'MOVIMIENTO INTERNO'],
  ['Devolucion Saldo de caja chica', 'MOVIMIENTO INTERNO'],
  ['INGRESO DE CAJAS DIARIAS', 'MOVIMIENTO INTERNO'],
  ['ENTREGA EFVO CARLOS/PABLO', 'MOVIMIENTO INTERNO'],
  ['Ingreso a Caja chica Chango Mas Walter', 'MOVIMIENTO INTERNO'],
  ['Ingreso a Caja chica Chango Mas', 'MOVIMIENTO INTERNO'],
  ['Pago a personal Sweet Chango Mas', 'SUELDOS'],
  ['INICIO DE CAJA SEMANAL', 'MOVIMIENTO INTERNO'],
  ['INGRESO DEVOLUCION SALDO DE SUB CAJA CHICA', 'MOVIMIENTO INTERNO'],
  ['Pago Asig decreto personal pago', 'SUELDOS'],
  ['Pago Bono a personal', 'SUELDOS'],
  ['Pago liquidacion final personal', 'SUELDOS'],
  ['Pago personal Feriado', 'SUELDOS'],
  ['Pago personal semana', 'SUELDOS'],
  ['Pago sueldo personal mes', 'SUELDOS'],
  ['Articulos de Limpieza', 'LIMPIEZA'],
  ['Articulos de oficina', 'UTILES DE OFICINA'],
  ['AADI CAPIF', 'IMPUESTO'],
  ['Agua botellas', 'INGREDIENTES / INSUMOS'],
  ['Agua servicio', 'SERVICIOS'],
  ['Ajuste empleados sueldo hora', 'SUELDOS'],
  ['Alimentaria Chaco', 'INGREDIENTES / INSUMOS'],
  ['Arreglos - reparaciones - mantenimiento', 'MANTENIMIENTO'],
  ['Agua Bidones', 'INGREDIENTES / INSUMOS'],
  ['CACIQUE', 'INGREDIENTES / INSUMOS'],
  ['Caja Inicial', 'MOVIMIENTO INTERNO'],
  ['Car Car', 'INGREDIENTES / INSUMOS'],
  ['Coca Cola', 'INGREDIENTES / INSUMOS'],
  ['Combustible - Nafta', 'TRANSPORTE'],
  ['Combustible Kangoo', 'TRANSPORTE'],
  ['COMBUSTIBLE MERCEDES', 'TRANSPORTE'],
  ['Compra Chango Mas ingredientes', 'INGREDIENTES / INSUMOS'],
  ['Compra Chango Mas productos', 'INGREDIENTES / INSUMOS'],
  ['Compra libreria papelería', 'UTILES DE OFICINA'],
  ['Compra medicamentos remedios farmacia', 'GASTOS EXTRA'],
  ['Compra Verduleria - Fruteria', 'INGREDIENTES / INSUMOS'],
  ['Compra verduras frutas', 'INGREDIENTES / INSUMOS'],
  ['Compras varias, arreglos mantenimiento', 'MANTENIMIENTO'],
  ['Detergente', 'LIMPIEZA'],
  ['El Pibe Distribuidora - Mayorista', 'INGREDIENTES / INSUMOS'],
  ['Electricidad - Electricista', 'MANTENIMIENTO'],
  ['ENTREGA EFVO CUÑADO CARLOS', 'MOVIMIENTO INTERNO'],
  ['Ferreteria', 'MANTENIMIENTO'],
  ['FRIAR', 'INGREDIENTES / INSUMOS'],
  ['Fruteria', 'INGREDIENTES / INSUMOS'],
  ['Fumigacion - Control', 'SERVICIOS'],
  ['Hamburguesas Caseras Swift', 'INGREDIENTES / INSUMOS'],
  ['Jugo de naranja', 'INGREDIENTES / INSUMOS'],
  ['La virginia', 'INGREDIENTES / INSUMOS'],
  ['Leche', 'INGREDIENTES / INSUMOS'],
  ['Limpieza', 'LIMPIEZA'],
  ['Motomandado - envios - flete', 'TRANSPORTE'],
  ['Naranjas', 'INGREDIENTES / INSUMOS'],
  ['OSECAC', 'SERVICIOS'],
  ['Pago Tarjeta Cencosud (Carlos)', 'GASTOS PERSONALES'],
  ['Pan de miga', 'INGREDIENTES / INSUMOS'],
  ['Pan superpancho', 'INGREDIENTES / INSUMOS'],
  ['Piramide Distribuidora - Mayorista', 'INGREDIENTES / INSUMOS'],
  ['Plomero tecnico electricista gasista', 'MANTENIMIENTO'],
  ['Quesos', 'INGREDIENTES / INSUMOS'],
  ['Recor SRL', 'INGREDIENTES / INSUMOS'],
  ['Record Levadura', 'INGREDIENTES / INSUMOS'],
  ['Remis', 'TRANSPORTE'],
  ['Retiro Efectivo Cristian Rissione', 'MOVIMIENTO INTERNO'],
  ['SMP mayorista', 'INGREDIENTES / INSUMOS'],
  ['Swift Hamburguesas Caseras', 'INGREDIENTES / INSUMOS'],
  ['Tomate', 'INGREDIENTES / INSUMOS'],
  ['Tregar Leche', 'INGREDIENTES / INSUMOS'],
  ['Verduleria', 'INGREDIENTES / INSUMOS'],
  ['Vital Mayorista distribuidora', 'INGREDIENTES / INSUMOS'],
  ['Yaguar Mayorista distribuidora', 'INGREDIENTES / INSUMOS'],
  ['Pago de vacaciones personal', 'SUELDOS'],
  ['Polo Sur', 'INGREDIENTES / INSUMOS'],
  ['Compra Hiper Libertad', 'INGREDIENTES / INSUMOS'],
  ['REINGRESO (CAJA CHICA)', 'MOVIMIENTO INTERNO'],
  ['INGRESO A CAJA CHICA', 'MOVIMIENTO INTERNO'],
  ['Adelanto sueldo', 'SUELDOS'],
  ['Horas extras', 'SUELDOS'],
  ['Manfrey', 'PROVEEDORES'],
  ['PAGO PERSONAL CHANGO MAS', 'SUELDOS'],
];

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function defaultCatalog() {
  return {
    clasificaciones: [...CLASIFICACIONES_DEFAULT],
    items: ITEMS_DEFAULT.map(([item, clasificacion]) => ({ id: crypto.randomUUID(), item, clasificacion })),
  };
}

async function loadCatalog(env) {
  const raw = await env.CAJACHICA_DATA.get(KV_KEY);
  if (!raw) {
    const seeded = defaultCatalog();
    await env.CAJACHICA_DATA.put(KV_KEY, JSON.stringify(seeded));
    return seeded;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.items) || !Array.isArray(parsed.clasificaciones)) throw new Error('shape');
    return parsed;
  } catch {
    const seeded = defaultCatalog();
    await env.CAJACHICA_DATA.put(KV_KEY, JSON.stringify(seeded));
    return seeded;
  }
}

async function saveCatalog(env, catalog) {
  await env.CAJACHICA_DATA.put(KV_KEY, JSON.stringify(catalog));
}

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method.toUpperCase();
  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (!env.CAJACHICA_DATA) {
    return json({ error: 'Binding KV "CAJACHICA_DATA" no encontrado. Ver wrangler.jsonc.' }, 500);
  }

  if (method === 'GET') {
    const catalog = await loadCatalog(env);
    return json({ ok: true, ...catalog });
  }

  // ── ÍTEMS ────────────────────────────────────────────────────
  if (action === 'item') {
    const catalog = await loadCatalog(env);

    if (method === 'POST') {
      let body;
      try { body = await request.json(); } catch { return json({ error: 'Body inválido.' }, 400); }
      const item = (body.item || '').toString().trim();
      const clasificacion = (body.clasificacion || '').toString().trim();
      if (!item || !clasificacion) return json({ error: 'Faltan los campos: item, clasificacion' }, 400);
      if (catalog.items.some(i => i.item.toLowerCase() === item.toLowerCase())) {
        return json({ error: 'Ya existe un ítem con ese nombre.' }, 400);
      }
      if (!catalog.clasificaciones.includes(clasificacion)) catalog.clasificaciones.push(clasificacion);
      const row = { id: crypto.randomUUID(), item, clasificacion };
      catalog.items.push(row);
      await saveCatalog(env, catalog);
      return json({ ok: true, item: row });
    }

    if (method === 'PUT') {
      const id = url.searchParams.get('id');
      const idx = catalog.items.findIndex(i => i.id === id);
      if (idx === -1) return json({ error: 'Ítem no encontrado.' }, 404);
      let body;
      try { body = await request.json(); } catch { return json({ error: 'Body inválido.' }, 400); }
      if (body.item) catalog.items[idx].item = String(body.item).trim();
      if (body.clasificacion) {
        const clasificacion = String(body.clasificacion).trim();
        if (!catalog.clasificaciones.includes(clasificacion)) catalog.clasificaciones.push(clasificacion);
        catalog.items[idx].clasificacion = clasificacion;
      }
      await saveCatalog(env, catalog);
      return json({ ok: true, item: catalog.items[idx] });
    }

    if (method === 'DELETE') {
      const id = url.searchParams.get('id');
      catalog.items = catalog.items.filter(i => i.id !== id);
      await saveCatalog(env, catalog);
      return json({ ok: true });
    }
  }

  // ── CLASIFICACIONES ──────────────────────────────────────────
  if (action === 'clasificacion') {
    const catalog = await loadCatalog(env);

    if (method === 'POST') {
      let body;
      try { body = await request.json(); } catch { return json({ error: 'Body inválido.' }, 400); }
      const nombre = (body.nombre || '').toString().trim().toUpperCase();
      if (!nombre) return json({ error: 'Falta el campo: nombre' }, 400);
      if (catalog.clasificaciones.includes(nombre)) return json({ error: 'Ya existe esa clasificación.' }, 400);
      catalog.clasificaciones.push(nombre);
      await saveCatalog(env, catalog);
      return json({ ok: true });
    }

    if (method === 'PUT') {
      const viejo = url.searchParams.get('nombre');
      let body;
      try { body = await request.json(); } catch { return json({ error: 'Body inválido.' }, 400); }
      const nuevo = (body.nombre || '').toString().trim().toUpperCase();
      if (!viejo || !nuevo) return json({ error: 'Faltan datos.' }, 400);
      if (!catalog.clasificaciones.includes(viejo)) return json({ error: 'Clasificación no encontrada.' }, 404);
      if (viejo !== nuevo && catalog.clasificaciones.includes(nuevo)) return json({ error: 'Ya existe una clasificación con ese nombre.' }, 400);
      catalog.clasificaciones = catalog.clasificaciones.map(c => c === viejo ? nuevo : c);
      catalog.items.forEach(i => { if (i.clasificacion === viejo) i.clasificacion = nuevo; });
      await saveCatalog(env, catalog);
      return json({ ok: true });
    }

    if (method === 'DELETE') {
      const nombre = url.searchParams.get('nombre');
      const enUso = catalog.items.filter(i => i.clasificacion === nombre).length;
      if (enUso > 0) {
        return json({ error: `No se puede eliminar: ${enUso} ítem${enUso !== 1 ? 's' : ''} todavía la usa${enUso !== 1 ? 'n' : ''}. Reasigná esos ítems primero.` }, 400);
      }
      catalog.clasificaciones = catalog.clasificaciones.filter(c => c !== nombre);
      await saveCatalog(env, catalog);
      return json({ ok: true });
    }
  }

  return json({ error: 'Método o acción no soportada.' }, 405);
}
