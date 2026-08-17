// ============================================
// CONFIGURACIÓN — CAJA CHICA
// ============================================

const CONFIG = {
  // Mismos ids que el resto del sistema (menu.js, rendicion/js/config.js)
  locales: [
    { id: 'rissione', nombre: 'Sweet Rissione' },
    { id: 'hiper', nombre: 'Sweet Hiper' },
    { id: 'changoMas', nombre: 'Sweet Chango Más' },
  ],

  // Clasificaciones (para filtrar y, más adelante, graficar). El orden acá
  // define el orden de los <optgroup> en el selector de ítem.
  clasificaciones: [
    'MOVIMIENTO INTERNO',
    'SUELDOS',
    'INGREDIENTES / INSUMOS',
    'PROVEEDORES',
    'SERVICIOS',
    'MANTENIMIENTO',
    'TRANSPORTE',
    'LIMPIEZA',
    'UTILES DE OFICINA',
    'IMPUESTO',
    'GASTOS PERSONALES',
    'GASTOS EXTRA',
  ],

  // Catálogo de ítems de gasto/ingreso, con su clasificación — tal cual las
  // planillas históricas de Caja Chica de cada local (Excel).
  itemsCajaChica: [
    { item: 'DEPOSITO A SUB CAJA CHICA', clasificacion: 'MOVIMIENTO INTERNO' },
    { item: 'Devolucion Saldo de caja chica', clasificacion: 'MOVIMIENTO INTERNO' },
    { item: 'INGRESO DE CAJAS DIARIAS', clasificacion: 'MOVIMIENTO INTERNO' },
    { item: 'ENTREGA EFVO CARLOS/PABLO', clasificacion: 'MOVIMIENTO INTERNO' },
    { item: 'Ingreso a Caja chica Chango Mas Walter', clasificacion: 'MOVIMIENTO INTERNO' },
    { item: 'Ingreso a Caja chica Chango Mas', clasificacion: 'MOVIMIENTO INTERNO' },
    { item: 'Pago a personal Sweet Chango Mas', clasificacion: 'SUELDOS' },
    { item: 'INICIO DE CAJA SEMANAL', clasificacion: 'MOVIMIENTO INTERNO' },
    { item: 'INGRESO DEVOLUCION SALDO DE SUB CAJA CHICA', clasificacion: 'MOVIMIENTO INTERNO' },
    { item: 'Pago Asig decreto personal pago', clasificacion: 'SUELDOS' },
    { item: 'Pago Bono a personal', clasificacion: 'SUELDOS' },
    { item: 'Pago liquidacion final personal', clasificacion: 'SUELDOS' },
    { item: 'Pago personal Feriado', clasificacion: 'SUELDOS' },
    { item: 'Pago personal semana', clasificacion: 'SUELDOS' },
    { item: 'Pago sueldo personal mes', clasificacion: 'SUELDOS' },
    { item: 'Articulos de Limpieza', clasificacion: 'LIMPIEZA' },
    { item: 'Articulos de oficina', clasificacion: 'UTILES DE OFICINA' },
    { item: 'AADI CAPIF', clasificacion: 'IMPUESTO' },
    { item: 'Agua botellas', clasificacion: 'INGREDIENTES / INSUMOS' },
    { item: 'Agua servicio', clasificacion: 'SERVICIOS' },
    { item: 'Ajuste empleados sueldo hora', clasificacion: 'SUELDOS' },
    { item: 'Alimentaria Chaco', clasificacion: 'INGREDIENTES / INSUMOS' },
    { item: 'Arreglos - reparaciones - mantenimiento', clasificacion: 'MANTENIMIENTO' },
    { item: 'Agua Bidones', clasificacion: 'INGREDIENTES / INSUMOS' },
    { item: 'CACIQUE', clasificacion: 'INGREDIENTES / INSUMOS' },
    { item: 'Caja Inicial', clasificacion: 'MOVIMIENTO INTERNO' },
    { item: 'Car Car', clasificacion: 'INGREDIENTES / INSUMOS' },
    { item: 'Coca Cola', clasificacion: 'INGREDIENTES / INSUMOS' },
    { item: 'Combustible - Nafta', clasificacion: 'TRANSPORTE' },
    { item: 'Combustible Kangoo', clasificacion: 'TRANSPORTE' },
    { item: 'COMBUSTIBLE MERCEDES', clasificacion: 'TRANSPORTE' },
    { item: 'Compra Chango Mas ingredientes', clasificacion: 'INGREDIENTES / INSUMOS' },
    { item: 'Compra Chango Mas productos', clasificacion: 'INGREDIENTES / INSUMOS' },
    { item: 'Compra libreria papelería', clasificacion: 'UTILES DE OFICINA' },
    { item: 'Compra medicamentos remedios farmacia', clasificacion: 'GASTOS EXTRA' },
    { item: 'Compra Verduleria - Fruteria', clasificacion: 'INGREDIENTES / INSUMOS' },
    { item: 'Compra verduras frutas', clasificacion: 'INGREDIENTES / INSUMOS' },
    { item: 'Compras varias, arreglos mantenimiento', clasificacion: 'MANTENIMIENTO' },
    { item: 'Detergente', clasificacion: 'LIMPIEZA' },
    { item: 'El Pibe Distribuidora - Mayorista', clasificacion: 'INGREDIENTES / INSUMOS' },
    { item: 'Electricidad - Electricista', clasificacion: 'MANTENIMIENTO' },
    { item: 'ENTREGA EFVO CUÑADO CARLOS', clasificacion: 'MOVIMIENTO INTERNO' },
    { item: 'Ferreteria', clasificacion: 'MANTENIMIENTO' },
    { item: 'FRIAR', clasificacion: 'INGREDIENTES / INSUMOS' },
    { item: 'Fruteria', clasificacion: 'INGREDIENTES / INSUMOS' },
    { item: 'Fumigacion - Control', clasificacion: 'SERVICIOS' },
    { item: 'Hamburguesas Caseras Swift', clasificacion: 'INGREDIENTES / INSUMOS' },
    { item: 'Jugo de naranja', clasificacion: 'INGREDIENTES / INSUMOS' },
    { item: 'La virginia', clasificacion: 'INGREDIENTES / INSUMOS' },
    { item: 'Leche', clasificacion: 'INGREDIENTES / INSUMOS' },
    { item: 'Limpieza', clasificacion: 'LIMPIEZA' },
    { item: 'Motomandado - envios - flete', clasificacion: 'TRANSPORTE' },
    { item: 'Naranjas', clasificacion: 'INGREDIENTES / INSUMOS' },
    { item: 'OSECAC', clasificacion: 'SERVICIOS' },
    { item: 'Pago Tarjeta Cencosud (Carlos)', clasificacion: 'GASTOS PERSONALES' },
    { item: 'Pan de miga', clasificacion: 'INGREDIENTES / INSUMOS' },
    { item: 'Pan superpancho', clasificacion: 'INGREDIENTES / INSUMOS' },
    { item: 'Piramide Distribuidora - Mayorista', clasificacion: 'INGREDIENTES / INSUMOS' },
    { item: 'Plomero tecnico electricista gasista', clasificacion: 'MANTENIMIENTO' },
    { item: 'Quesos', clasificacion: 'INGREDIENTES / INSUMOS' },
    { item: 'Recor SRL', clasificacion: 'INGREDIENTES / INSUMOS' },
    { item: 'Record Levadura', clasificacion: 'INGREDIENTES / INSUMOS' },
    { item: 'Remis', clasificacion: 'TRANSPORTE' },
    { item: 'Retiro Efectivo Cristian Rissione', clasificacion: 'MOVIMIENTO INTERNO' },
    { item: 'SMP mayorista', clasificacion: 'INGREDIENTES / INSUMOS' },
    { item: 'Swift Hamburguesas Caseras', clasificacion: 'INGREDIENTES / INSUMOS' },
    { item: 'Tomate', clasificacion: 'INGREDIENTES / INSUMOS' },
    { item: 'Tregar Leche', clasificacion: 'INGREDIENTES / INSUMOS' },
    { item: 'Verduleria', clasificacion: 'INGREDIENTES / INSUMOS' },
    { item: 'Vital Mayorista distribuidora', clasificacion: 'INGREDIENTES / INSUMOS' },
    { item: 'Yaguar Mayorista distribuidora', clasificacion: 'INGREDIENTES / INSUMOS' },
    { item: 'Pago de vacaciones personal', clasificacion: 'SUELDOS' },
    { item: 'Polo Sur', clasificacion: 'INGREDIENTES / INSUMOS' },
    { item: 'Compra Hiper Libertad', clasificacion: 'INGREDIENTES / INSUMOS' },
    { item: 'REINGRESO (CAJA CHICA)', clasificacion: 'MOVIMIENTO INTERNO' },
    { item: 'INGRESO A CAJA CHICA', clasificacion: 'MOVIMIENTO INTERNO' },
    { item: 'Adelanto sueldo', clasificacion: 'SUELDOS' },
    { item: 'Horas extras', clasificacion: 'SUELDOS' },
    { item: 'Manfrey', clasificacion: 'PROVEEDORES' },
    { item: 'PAGO PERSONAL CHANGO MAS', clasificacion: 'SUELDOS' },
  ],

  // Ítems que casi siempre son un ingreso (para preseleccionar el sentido
  // del movimiento en el formulario — el usuario igual puede cambiarlo).
  itemsTipicamenteIngreso: [
    'DEPOSITO A SUB CAJA CHICA', 'INGRESO DE CAJAS DIARIAS', 'Ingreso a Caja chica Chango Mas Walter',
    'Ingreso a Caja chica Chango Mas', 'INICIO DE CAJA SEMANAL', 'INGRESO DEVOLUCION SALDO DE SUB CAJA CHICA',
    'Caja Inicial', 'REINGRESO (CAJA CHICA)', 'INGRESO A CAJA CHICA',
  ],
};

// ============================================
// ALMACENAMIENTO — Cloudflare D1 vía /api/caja-chica
// ============================================

const Storage = {
  async listar({ localId, estado, desde, hasta, clasificacion, q } = {}) {
    const params = new URLSearchParams();
    if (localId) params.set('local', localId);
    if (estado) params.set('estado', estado);
    if (desde) params.set('desde', desde);
    if (hasta) params.set('hasta', hasta);
    if (clasificacion) params.set('clasificacion', clasificacion);
    if (q) params.set('q', q);

    const res = await fetch(`/api/caja-chica?${params.toString()}`);
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudieron cargar los movimientos.');
    return data.movimientos;
  },

  async crear(mov) {
    const res = await fetch('/api/caja-chica', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mov),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo guardar el movimiento.');
    return { ...mov, id: data.id };
  },

  async eliminar(id) {
    const res = await fetch(`/api/caja-chica?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo eliminar el movimiento.');
  },

  async cerrarCaja(localId, localNombre) {
    const res = await fetch('/api/caja-chica?action=cerrar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ local_id: localId, local_nombre: localNombre }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo cerrar la caja.');
    return data;
  },
};
