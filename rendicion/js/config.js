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

  // Empleados por local (placeholder — reemplazar por los nombres reales cuando los tengas)
  empleados: {
    'rissione': [
      { id: 'emp-1', nombre: 'Empleado 1' },
      { id: 'emp-2', nombre: 'Empleado 2' },
    ],
    'hiper': [
      { id: 'emp-3', nombre: 'Empleado 1' },
      { id: 'emp-4', nombre: 'Empleado 2' },
    ],
    'changoMas': [
      { id: 'emp-5', nombre: 'Empleado 1' },
      { id: 'emp-6', nombre: 'Empleado 2' },
    ],
  },

  // Denominaciones de billetes (en pesos)
  denominaciones: [10, 20, 50, 100, 200, 500, 1000, 2000, 10000, 20000],

  // Medios de pago electrónicos
  mediosPago: [
    { id: 'debito', nombre: 'Débito', icono: '💳' },
    { id: 'credito', nombre: 'Crédito', icono: '💳' },
    { id: 'qr', nombre: 'QR', icono: '📱' },
    { id: 'mp_point', nombre: 'MercadoPago Point', icono: '📟' },
    { id: 'pedidos_ya', nombre: 'PedidosYa', icono: '📦' },
    { id: 'transferencia', nombre: 'Transferencia', icono: '🏦' },
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
    const res = await fetch('/api/rendiciones', {
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

    const res = await fetch(`/api/rendiciones?${params.toString()}`);
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || 'No se pudieron cargar las rendiciones.');
    }
    return data.rendiciones;
  },

  async delete(id) {
    const res = await fetch(`/api/rendiciones?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || 'No se pudo eliminar la rendición.');
    }
  },
};
