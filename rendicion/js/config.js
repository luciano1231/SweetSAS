// ============================================
// CONFIGURACIÓN DEL SISTEMA
// ============================================
// Fase 1: localStorage | Fase 2: Supabase
// ============================================

const CONFIG = {
  // --- Supabase (se activa en Fase 2) ---
  supabase: {
    url: '',
    anonKey: '',
  },

  // --- Datos del negocio ---
  // Mismos ids que usa el editor de menú (functions/api/menu.js, menu-editor.html)
  locales: [
    { id: 'rissione', nombre: 'Sweet Rissione' },
    { id: 'hiper', nombre: 'Sweet Hiper' },
    { id: 'changoMas', nombre: 'Sweet Chango Más' },
  ],

  turnos: ['Mañana', 'Tarde'],

  // Los empleados por local ya NO están hardcodeados acá — se administran
  // desde empleados.html y se leen en vivo vía /api/empleados
  // (ver rendicion/js/carga.js → populateEmpleados()).

  // Denominaciones de billetes (en pesos)
  denominaciones: [10, 20, 50, 100, 200, 500, 1000, 2000, 10000, 20000],

  // Medios de pago electrónicos
  // (los "icono" son SVG de línea de 18x18, mismo estilo que el resto del sistema)
  mediosPago: [
    { id: 'debito', nombre: 'Débito', icono: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>' },
    { id: 'credito', nombre: 'Crédito', icono: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>' },
    { id: 'qr', nombre: 'QR', icono: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect><rect x="14" y="14" width="3" height="3"></rect><rect x="18" y="14" width="3" height="3"></rect><rect x="14" y="18" width="3" height="3"></rect><rect x="18" y="18" width="3" height="3"></rect></svg>' },
    { id: 'mp_point', nombre: 'MercadoPago Point', icono: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>' },
    { id: 'pedidos_ya', nombre: 'PedidosYa', icono: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16.5 9.4 7.55 4.24"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>' },
    { id: 'transferencia', nombre: 'Transferencia', icono: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="22" x2="21" y2="22"></line><line x1="6" y1="18" x2="6" y2="11"></line><line x1="10" y1="18" x2="10" y2="11"></line><line x1="14" y1="18" x2="14" y2="11"></line><line x1="18" y1="18" x2="18" y2="11"></line><polygon points="12 2 20 7 4 7"></polygon></svg>' },
  ],

  // Clave para localStorage
  storageKey: 'rendiciones_ingresos',
};

// ============================================
// FUNCIONES DE ALMACENAMIENTO
// Backend real: Cloudflare D1 vía /api/rendiciones — se comparte entre
// todos los locales y dispositivos (antes vivía solo en localStorage,
// atrapado en cada navegador).
// ============================================

const Storage = {
  async save(rendicion) {
    const res = await window.sweetAuth.fetch('/api/rendiciones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rendicion),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || 'No se pudo guardar la rendición.');
    }
    return { ...rendicion, id: data.id };
  },

  async getFiltered({ localId, fechaDesde, fechaHasta, turno } = {}) {
    const params = new URLSearchParams();
    if (localId) params.set('local', localId);
    if (turno) params.set('turno', turno);
    if (fechaDesde) params.set('desde', fechaDesde);
    if (fechaHasta) params.set('hasta', fechaHasta);

    const res = await window.sweetAuth.fetch(`/api/rendiciones?${params.toString()}`);
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || 'No se pudieron cargar las rendiciones.');
    }
    return data.rendiciones;
  },

  async delete(id) {
    const res = await window.sweetAuth.fetch(`/api/rendiciones?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || 'No se pudo eliminar la rendición.');
    }
  },
};
