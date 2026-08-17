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

  // El catálogo de clasificaciones/ítems ya NO está fijo acá — vive en KV y
  // se administra desde caja-chica/items.html (dueño/supervisor). Ver
  // Storage.cargarCatalogo() más abajo.

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

  // ── Catálogo de ítems / clasificaciones (editable desde items.html) ──
  async cargarCatalogo() {
    const res = await fetch('/api/caja-chica-items');
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo cargar el catálogo de ítems.');
    return { items: data.items, clasificaciones: data.clasificaciones };
  },

  async crearItem(item, clasificacion) {
    const res = await fetch('/api/caja-chica-items?action=item', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item, clasificacion }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo crear el ítem.');
    return data.item;
  },

  async editarItem(id, cambios) {
    const res = await fetch(`/api/caja-chica-items?action=item&id=${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cambios),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo editar el ítem.');
    return data.item;
  },

  async eliminarItem(id) {
    const res = await fetch(`/api/caja-chica-items?action=item&id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo eliminar el ítem.');
  },

  async crearClasificacion(nombre) {
    const res = await fetch('/api/caja-chica-items?action=clasificacion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo crear la clasificación.');
  },

  async renombrarClasificacion(nombreViejo, nombreNuevo) {
    const res = await fetch(`/api/caja-chica-items?action=clasificacion&nombre=${encodeURIComponent(nombreViejo)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: nombreNuevo }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo renombrar la clasificación.');
  },

  async eliminarClasificacion(nombre) {
    const res = await fetch(`/api/caja-chica-items?action=clasificacion&nombre=${encodeURIComponent(nombre)}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo eliminar la clasificación.');
  },
};
