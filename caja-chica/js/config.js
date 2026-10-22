// ============================================
// CONFIGURACIÓN — CAJA CHICA
// ============================================

const CONFIG = {
  // Mismos ids que el resto del sistema (menu.js, rendicion/js/config.js)
  locales: [
    { id: 'rissione', nombre: 'Sweet Rissione' },
    { id: 'hiper', nombre: 'Sweet Hiper' },
    { id: 'changoMas', nombre: 'Sweet Chango Más' },
    // Caja central: no es un local de venta. Usa su propio catálogo de ítems,
    // recibe la devolución de saldo cuando se cierra la caja de Rissione y
    // arrastra su saldo (no se le exige cerrar en $0).
    { id: 'produccion', nombre: 'Caja Chica Producción', catalogo: 'produccion', sinRendicion: true, arrastraSaldo: true, recibeDe: ['rissione'] },
  ],

  // Catálogos de ítems disponibles (ver functions/api/caja-chica-items.js).
  catalogos: [
    { id: 'general', nombre: 'Locales (Rissione, Hiper, Chango Más)' },
    { id: 'produccion', nombre: 'Producción' },
  ],

  // El catálogo de clasificaciones/ítems ya NO está fijo acá — vive en KV y
  // se administra desde caja-chica/items.html (dueño/supervisor). Ver
  // Storage.cargarCatalogo() más abajo.

  // Ítems que casi siempre son un ingreso (para preseleccionar el sentido
  // del movimiento en el formulario — el usuario igual puede cambiarlo).
  // En Producción además cuenta todo lo que empieza con "Ingreso" (ítem o
  // clasificación), ver esTipicamenteIngreso().
  itemsTipicamenteIngreso: [
    'DEPOSITO A SUB CAJA CHICA', 'INGRESO DE CAJAS DIARIAS', 'Ingreso a Caja chica Chango Mas Walter',
    'Ingreso a Caja chica Chango Mas', 'INICIO DE CAJA SEMANAL', 'INGRESO DEVOLUCION SALDO DE SUB CAJA CHICA',
    'Caja Inicial', 'REINGRESO (CAJA CHICA)', 'INGRESO A CAJA CHICA',
  ],
  itemsTipicamenteIngresoProduccion: ['Venta a empleado', 'Devolución préstamo', 'Diferencia sobrante'],

  catalogoDe(localId) {
    const local = this.locales.find(l => l.id === localId);
    return (local && local.catalogo) || 'general';
  },

  esTipicamenteIngreso(localId, item, clasificacion) {
    if (this.catalogoDe(localId) !== 'produccion') return this.itemsTipicamenteIngreso.includes(item);
    if (/^ingreso/i.test(item) || /^ingreso/i.test(clasificacion)) return true;
    return this.itemsTipicamenteIngresoProduccion.includes(item);
  },
};

// ============================================
// ALMACENAMIENTO — Cloudflare D1 vía /api/caja-chica
// ============================================

const Storage = {
  async listar({ localId, estado, desde, hasta, clasificacion, q, vinculadas } = {}) {
    const params = new URLSearchParams();
    if (localId) params.set('local', localId);
    if (estado) params.set('estado', estado);
    if (desde) params.set('desde', desde);
    if (hasta) params.set('hasta', hasta);
    if (clasificacion) params.set('clasificacion', clasificacion);
    if (q) params.set('q', q);
    if (vinculadas) params.set('vinculadas', '1');

    const res = await window.sweetAuth.fetch(`/api/caja-chica?${params.toString()}`);
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudieron cargar los movimientos.');
    return data.movimientos;
  },

  // Pendientes de un local + saldo de lo ya enviado al historial (solo lo
  // devuelve el server para cajas que arrastran saldo, como Producción).
  async listarPendientes(localId) {
    const params = new URLSearchParams({ local: localId, estado: 'pendiente' });
    const res = await window.sweetAuth.fetch(`/api/caja-chica?${params.toString()}`);
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudieron cargar los movimientos.');
    return { movimientos: data.movimientos, saldoAnterior: data.saldo_anterior || 0, limite: data.limite_pendientes || null };
  },

  async crear(mov) {
    const res = await window.sweetAuth.fetch('/api/caja-chica', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mov),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo guardar el movimiento.');
    return { ...mov, id: data.id };
  },

  async eliminar(id) {
    const res = await window.sweetAuth.fetch(`/api/caja-chica?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo eliminar el movimiento.');
  },

  async cerrarCaja(localId, localNombre) {
    const res = await window.sweetAuth.fetch('/api/caja-chica?action=cerrar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ local_id: localId, local_nombre: localNombre }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo cerrar la caja.');
    return data;
  },

  // ── Catálogo de ítems / clasificaciones (editable desde items.html) ──
  // Catálogo activo ('general' | 'produccion'). Lo fija cada página según
  // el local/caja que está mostrando; todas las llamadas de abajo lo usan.
  catalogo: 'general',

  _catParam() {
    return 'catalogo=' + encodeURIComponent(this.catalogo || 'general');
  },

  async cargarCatalogo() {
    const res = await window.sweetAuth.fetch(`/api/caja-chica-items?${this._catParam()}`);
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo cargar el catálogo de ítems.');
    return { items: data.items, clasificaciones: data.clasificaciones };
  },

  async crearItem(item, clasificacion) {
    const res = await window.sweetAuth.fetch(`/api/caja-chica-items?action=item&${this._catParam()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item, clasificacion }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo crear el ítem.');
    return data.item;
  },

  async editarItem(id, cambios) {
    const res = await window.sweetAuth.fetch(`/api/caja-chica-items?action=item&id=${encodeURIComponent(id)}&${this._catParam()}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cambios),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo editar el ítem.');
    return data.item;
  },

  async eliminarItem(id) {
    const res = await window.sweetAuth.fetch(`/api/caja-chica-items?action=item&id=${encodeURIComponent(id)}&${this._catParam()}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo eliminar el ítem.');
  },

  async crearClasificacion(nombre) {
    const res = await window.sweetAuth.fetch(`/api/caja-chica-items?action=clasificacion&${this._catParam()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo crear la clasificación.');
  },

  async renombrarClasificacion(nombreViejo, nombreNuevo) {
    const res = await window.sweetAuth.fetch(`/api/caja-chica-items?action=clasificacion&nombre=${encodeURIComponent(nombreViejo)}&${this._catParam()}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: nombreNuevo }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo renombrar la clasificación.');
  },

  async eliminarClasificacion(nombre) {
    const res = await window.sweetAuth.fetch(`/api/caja-chica-items?action=clasificacion&nombre=${encodeURIComponent(nombre)}&${this._catParam()}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo eliminar la clasificación.');
  },
};
