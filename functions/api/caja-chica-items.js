/**
 * Cloudflare Pages Function — /api/caja-chica-items
 *
 * Catálogo (editable) de ítems y clasificaciones de Caja Chica. Vive en KV
 * (binding CAJACHICA_DATA) y se siembra con la lista histórica de las
 * planillas Excel la primera vez que se lee.
 *
 * Hay dos catálogos independientes, elegidos con ?catalogo= (todas las
 * rutas de abajo lo aceptan):
 *   - general    (default, key "catalog")            → Rissione, Hiper, Chango Más
 *   - produccion (key "catalog:produccion")          → Caja Chica Producción
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

import { obtenerSesion, tieneRol } from '../lib/session.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Catálogo → key en KV + semilla. Producción tiene sus propias referencias
// (planilla "Referencias de caja chica Producción"), no comparte con los locales.
const CATALOGOS = {
  general: { kvKey: 'catalog', seed: () => ({ clasificaciones: CLASIFICACIONES_DEFAULT, items: ITEMS_DEFAULT }) },
  produccion: { kvKey: 'catalog:produccion', seed: () => ({ clasificaciones: CLASIFICACIONES_PRODUCCION, items: ITEMS_PRODUCCION }) },
};

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

// ── Caja Chica Producción ────────────────────────────────────────
// Columna A (ítem) y columna C (clasificación) de la planilla de
// referencias, con mayúsculas/acentos normalizados para el desplegable y
// los duplicados unificados (Librería, Harina, Nutriletti, Ingreso efectivo).
// "Gastos Vedia" no tenía clasificación en la planilla → GASTOS VARIOS.
const CLASIFICACIONES_PRODUCCION = [
  'INGRESOS', 'INGRESO PANADERIA RISSIONE', 'INGRESO SWEET', 'INGRESO CHANGO MAS',
  'MOVIMIENTO INTERNO', 'ENTREGA DE EFECTIVO', 'SUELDOS', 'PRESTAMOS',
  'INGREDIENTES / INSUMOS', 'PROVEEDORES', 'LIMPIEZA', 'MANTENIMIENTO',
  'SERVICE MANTENIMIENTO VEDIA', 'SERVICIOS', 'SERVICIO MOTOCAFE', 'TRANSPORTE',
  'UTILES DE OFICINA', 'IMPUESTO', 'MUEBLES', 'INVERSIONES',
  'GASTOS VARIOS', 'GASTOS EXTRA', 'GASTOS PERSONALES',
];

const ITEMS_PRODUCCION = [
  // Ingresos
  ['Ingreso efectivo', 'INGRESOS'],
  ['Ingreso efectivo mayorista proveedor', 'INGRESOS'],
  ['Ingreso panadería', 'INGRESOS'],
  ['Ingreso cajas', 'INGRESOS'],
  ['Ingreso Walter', 'INGRESOS'],
  ['Ingreso a Walter para gastos', 'INGRESOS'],
  ['Ingreso S Bar', 'INGRESOS'],
  ['Ingreso Bronx', 'INGRESOS'],
  ['Ingreso mayorista Medialunas Time', 'INGRESOS'],
  ['Ingreso banco Galicia', 'INGRESOS'],
  ['Ingreso banco Tarjeta Tuya', 'INGRESOS'],
  ['Venta a empleado', 'INGRESOS'],
  ['Ingreso Sweet', 'INGRESO SWEET'],
  ['Ingreso Chango Más', 'INGRESO CHANGO MAS'],
  // Movimientos internos
  ['Retira Carlos / entrega efectivo', 'MOVIMIENTO INTERNO'],
  ['Retira Pablo / entrega efectivo', 'MOVIMIENTO INTERNO'],
  ['Ingreso efectivo Pablo', 'MOVIMIENTO INTERNO'],
  ['Depósito a sub caja chica', 'MOVIMIENTO INTERNO'],
  ['Ingreso a caja chica', 'MOVIMIENTO INTERNO'],
  ['Devolución saldo de caja chica', 'MOVIMIENTO INTERNO'],
  ['Ingreso devolución caja chica', 'MOVIMIENTO INTERNO'],
  ['Ingreso caja chica Cristian y Ángel', 'MOVIMIENTO INTERNO'],
  ['Diferencia faltante', 'MOVIMIENTO INTERNO'],
  ['Diferencia sobrante', 'MOVIMIENTO INTERNO'],
  // Sueldos
  ['Sueldos Rissione', 'SUELDOS'],
  ['Sueldos personal fracción', 'SUELDOS'],
  ['Sueldos personal adelanto', 'SUELDOS'],
  ['Sueldos personal liquidación final', 'SUELDOS'],
  ['Sueldos personal mes', 'SUELDOS'],
  ['Sueldos personal semana', 'SUELDOS'],
  ['Sueldos personal vacaciones', 'SUELDOS'],
  ['Pago sueldo personal', 'SUELDOS'],
  ['Pago sueldo Hiper', 'SUELDOS'],
  ['Pago sueldo Chango', 'SUELDOS'],
  ['Pago sueldo a personal día', 'SUELDOS'],
  ['Pago sueldo a personal semana', 'SUELDOS'],
  ['Pago sueldo a personal mes', 'SUELDOS'],
  ['Pago adelanto sueldos personal', 'SUELDOS'],
  ['WDM', 'SUELDOS'],
  ['Friomec', 'SUELDOS'],
  // Préstamos
  ['Préstamo a empleado', 'PRESTAMOS'],
  ['Devolución préstamo', 'PRESTAMOS'],
  // Ingredientes / insumos
  ['Ingredientes / insumos', 'INGREDIENTES / INSUMOS'],
  ['Insumos', 'INGREDIENTES / INSUMOS'],
  ['Compra ingredientes / productos', 'INGREDIENTES / INSUMOS'],
  ['Supermercado ingredientes', 'INGREDIENTES / INSUMOS'],
  ['Pago a mayorista', 'INGREDIENTES / INSUMOS'],
  ['Proveedor mayorista', 'INGREDIENTES / INSUMOS'],
  ['Lácteos', 'INGREDIENTES / INSUMOS'],
  ['Leche', 'INGREDIENTES / INSUMOS'],
  ['Quesos', 'INGREDIENTES / INSUMOS'],
  ['Muzzarela', 'INGREDIENTES / INSUMOS'],
  ['Manteca', 'INGREDIENTES / INSUMOS'],
  ['Dulce de leche', 'INGREDIENTES / INSUMOS'],
  ['Crema chantilly', 'INGREDIENTES / INSUMOS'],
  ['Huevos', 'INGREDIENTES / INSUMOS'],
  ['Harina', 'INGREDIENTES / INSUMOS'],
  ['Fécula de mandioca', 'INGREDIENTES / INSUMOS'],
  ['Azúcar', 'INGREDIENTES / INSUMOS'],
  ['Miel', 'INGREDIENTES / INSUMOS'],
  ['Galletitas', 'INGREDIENTES / INSUMOS'],
  ['Panificados', 'INGREDIENTES / INSUMOS'],
  ['Compra panificados', 'INGREDIENTES / INSUMOS'],
  ['Ravioli', 'INGREDIENTES / INSUMOS'],
  ['Compra carnes', 'INGREDIENTES / INSUMOS'],
  ['Molida', 'INGREDIENTES / INSUMOS'],
  ['Lomos', 'INGREDIENTES / INSUMOS'],
  ['Swift', 'INGREDIENTES / INSUMOS'],
  ['Tomate triturado', 'INGREDIENTES / INSUMOS'],
  ['Compra verdulería', 'INGREDIENTES / INSUMOS'],
  ['El Edén verdulería', 'INGREDIENTES / INSUMOS'],
  ['Ñalu verduras congeladas', 'INGREDIENTES / INSUMOS'],
  ['Compra frutas', 'INGREDIENTES / INSUMOS'],
  ['Frutas', 'INGREDIENTES / INSUMOS'],
  ['Aguas', 'INGREDIENTES / INSUMOS'],
  ['Bebidas', 'INGREDIENTES / INSUMOS'],
  ['Gaseosas', 'INGREDIENTES / INSUMOS'],
  ['Coca Cola', 'INGREDIENTES / INSUMOS'],
  ['Jugo Tang', 'INGREDIENTES / INSUMOS'],
  ['Jugos Citric', 'INGREDIENTES / INSUMOS'],
  ['Citrix', 'INGREDIENTES / INSUMOS'],
  ['Hielo', 'INGREDIENTES / INSUMOS'],
  ['Gas', 'INGREDIENTES / INSUMOS'],
  ['Adolfina', 'INGREDIENTES / INSUMOS'],
  ['Alimentaria Chaco SRL', 'INGREDIENTES / INSUMOS'],
  ['Biasoni', 'INGREDIENTES / INSUMOS'],
  ['Cacique', 'INGREDIENTES / INSUMOS'],
  ['Car Car', 'INGREDIENTES / INSUMOS'],
  ['Distribuidora Pirámide', 'INGREDIENTES / INSUMOS'],
  ['El Pibe', 'INGREDIENTES / INSUMOS'],
  ['El Tambo', 'INGREDIENTES / INSUMOS'],
  ['Friar', 'INGREDIENTES / INSUMOS'],
  ['Grandiet', 'INGREDIENTES / INSUMOS'],
  ['La Paulina', 'INGREDIENTES / INSUMOS'],
  ['La Virginia', 'INGREDIENTES / INSUMOS'],
  ['Lucero', 'INGREDIENTES / INSUMOS'],
  ['Manfrey', 'INGREDIENTES / INSUMOS'],
  ['Nardelli', 'INGREDIENTES / INSUMOS'],
  ['Nutriletti', 'INGREDIENTES / INSUMOS'],
  ['Polo Sur', 'INGREDIENTES / INSUMOS'],
  ['Tomax', 'INGREDIENTES / INSUMOS'],
  ['Tregar', 'INGREDIENTES / INSUMOS'],
  ['Yaguar mayorista proveedor', 'INGREDIENTES / INSUMOS'],
  ['SMP bolsas', 'INGREDIENTES / INSUMOS'],
  ['Resipack', 'INGREDIENTES / INSUMOS'],
  ['Imprepack', 'INGREDIENTES / INSUMOS'],
  ['Plasmatic', 'INGREDIENTES / INSUMOS'],
  ['Gráfica plastificados', 'INGREDIENTES / INSUMOS'],
  ['Pegamento', 'INGREDIENTES / INSUMOS'],
  ['Matafuego', 'INGREDIENTES / INSUMOS'],
  // Limpieza
  ['Limpieza', 'LIMPIEZA'],
  ['Compra limpieza', 'LIMPIEZA'],
  ['Artículos de limpieza', 'LIMPIEZA'],
  // Mantenimiento
  ['Mantenimiento', 'MANTENIMIENTO'],
  ['Service / mantenimiento', 'MANTENIMIENTO'],
  ['Arreglos service mantenimiento', 'MANTENIMIENTO'],
  ['Compra mantenimiento / arreglos', 'MANTENIMIENTO'],
  ['Materiales arreglo reparación', 'MANTENIMIENTO'],
  ['Mano de obra arreglos', 'MANTENIMIENTO'],
  ['Mano de obra plomero', 'MANTENIMIENTO'],
  ['Pinturas arreglos', 'MANTENIMIENTO'],
  ['Plomería', 'MANTENIMIENTO'],
  ['Electricista', 'MANTENIMIENTO'],
  ['Albañil', 'MANTENIMIENTO'],
  ['Jardinero', 'MANTENIMIENTO'],
  ['Ferretería', 'MANTENIMIENTO'],
  ['Instalación', 'MANTENIMIENTO'],
  ['Maquinaria', 'MANTENIMIENTO'],
  ['Repuesto arreglos maquinaria', 'MANTENIMIENTO'],
  ['Repuesto coches auto camioneta', 'MANTENIMIENTO'],
  ['Fumigación', 'MANTENIMIENTO'],
  ['Luis', 'MANTENIMIENTO'],
  ['Service mantenimiento Vedia', 'SERVICE MANTENIMIENTO VEDIA'],
  // Servicios
  ['Alquiler JM Paz', 'SERVICIOS'],
  ['Alquiler Rissione', 'SERVICIOS'],
  ['Luz (servicio)', 'SERVICIOS'],
  ['Agua (servicio)', 'SERVICIOS'],
  ['Internet (servicio)', 'SERVICIOS'],
  ['Honorarios varios', 'SERVICIOS'],
  ['Bisordi estudio', 'SERVICIOS'],
  ['Servicios gestor', 'SERVICIOS'],
  ['Recolector / basurero', 'SERVICIOS'],
  // Transporte
  ['Transporte', 'TRANSPORTE'],
  ['Combustible nafta', 'TRANSPORTE'],
  ['Nafta', 'TRANSPORTE'],
  ['Flete', 'TRANSPORTE'],
  ['Alquiler flete o camión', 'TRANSPORTE'],
  ['Acarreo', 'TRANSPORTE'],
  ['Motomandado', 'TRANSPORTE'],
  ['Remis', 'TRANSPORTE'],
  ['Uber', 'TRANSPORTE'],
  // Útiles de oficina
  ['Librería', 'UTILES DE OFICINA'],
  ['Papelera', 'UTILES DE OFICINA'],
  ['Útiles de oficina', 'UTILES DE OFICINA'],
  // Impuestos
  ['Industria y Comercio (impuesto)', 'IMPUESTO'],
  ['Pago impuesto', 'IMPUESTO'],
  // Muebles / inversiones
  ['Muebles', 'MUEBLES'],
  ['Glass', 'MUEBLES'],
  ['Obra', 'INVERSIONES'],
  ['Obra local delantero', 'INVERSIONES'],
  ['Obra trasero', 'INVERSIONES'],
  // Gastos varios / extra / personales
  ['Gastos varios', 'GASTOS VARIOS'],
  ['Gastos Vedia', 'GASTOS VARIOS'],
  ['Pago tarjeta de crédito', 'GASTOS VARIOS'],
  ['Alimento mascota', 'GASTOS EXTRA'],
  ['Veterinaria', 'GASTOS EXTRA'],
  ['Pagos gastos personales', 'GASTOS PERSONALES'],
];

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function defaultCatalog(def) {
  const { clasificaciones, items } = def.seed();
  return {
    clasificaciones: [...clasificaciones],
    items: items.map(([item, clasificacion]) => ({ id: crypto.randomUUID(), item, clasificacion })),
  };
}

async function loadCatalog(env, def) {
  const raw = await env.CAJACHICA_DATA.get(def.kvKey);
  if (!raw) {
    const seeded = defaultCatalog(def);
    await env.CAJACHICA_DATA.put(def.kvKey, JSON.stringify(seeded));
    return seeded;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.items) || !Array.isArray(parsed.clasificaciones)) throw new Error('shape');
    return parsed;
  } catch {
    const seeded = defaultCatalog(def);
    await env.CAJACHICA_DATA.put(def.kvKey, JSON.stringify(seeded));
    return seeded;
  }
}

async function saveCatalog(env, def, catalog) {
  await env.CAJACHICA_DATA.put(def.kvKey, JSON.stringify(catalog));
}

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method.toUpperCase();
  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  const def = CATALOGOS[url.searchParams.get('catalogo') || 'general'];

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (!env.CAJACHICA_DATA) {
    return json({ error: 'Binding KV "CAJACHICA_DATA" no encontrado. Ver wrangler.jsonc.' }, 500);
  }
  if (!def) return json({ error: 'Catálogo inválido.' }, 400);

  const session = await obtenerSesion(request, env);
  const tieneAccesoLocales = session && Array.isArray(session.permissions?.locales) && session.permissions.locales.length > 0;

  if (method === 'GET') {
    // Cualquiera con algún local asignado puede leer el catálogo (lo
    // necesita para el buscador de ítems al cargar un movimiento).
    if (!tieneAccesoLocales) return json({ error: 'No autorizado.' }, 403);
    const catalog = await loadCatalog(env, def);
    return json({ ok: true, ...catalog });
  }

  // Modificar el catálogo (alta/edición/borrado de ítems o clasificaciones)
  // es exclusivo de dueño/supervisor, igual que la página que lo gestiona.
  if (!tieneRol(session, 'owner', 'supervisor')) {
    return json({ error: 'No autorizado.' }, 403);
  }

  // ── ÍTEMS ────────────────────────────────────────────────────
  if (action === 'item') {
    const catalog = await loadCatalog(env, def);

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
      await saveCatalog(env, def, catalog);
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
      await saveCatalog(env, def, catalog);
      return json({ ok: true, item: catalog.items[idx] });
    }

    if (method === 'DELETE') {
      const id = url.searchParams.get('id');
      catalog.items = catalog.items.filter(i => i.id !== id);
      await saveCatalog(env, def, catalog);
      return json({ ok: true });
    }
  }

  // ── CLASIFICACIONES ──────────────────────────────────────────
  if (action === 'clasificacion') {
    const catalog = await loadCatalog(env, def);

    if (method === 'POST') {
      let body;
      try { body = await request.json(); } catch { return json({ error: 'Body inválido.' }, 400); }
      const nombre = (body.nombre || '').toString().trim().toUpperCase();
      if (!nombre) return json({ error: 'Falta el campo: nombre' }, 400);
      if (catalog.clasificaciones.includes(nombre)) return json({ error: 'Ya existe esa clasificación.' }, 400);
      catalog.clasificaciones.push(nombre);
      await saveCatalog(env, def, catalog);
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
      await saveCatalog(env, def, catalog);
      return json({ ok: true });
    }

    if (method === 'DELETE') {
      const nombre = url.searchParams.get('nombre');
      const enUso = catalog.items.filter(i => i.clasificacion === nombre).length;
      if (enUso > 0) {
        return json({ error: `No se puede eliminar: ${enUso} ítem${enUso !== 1 ? 's' : ''} todavía la usa${enUso !== 1 ? 'n' : ''}. Reasigná esos ítems primero.` }, 400);
      }
      catalog.clasificaciones = catalog.clasificaciones.filter(c => c !== nombre);
      await saveCatalog(env, def, catalog);
      return json({ ok: true });
    }
  }

  return json({ error: 'Método o acción no soportada.' }, 405);
}
