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
// FUNCIONES DE ALMACENAMIENTO (localStorage)
// Se reemplazan por Supabase en Fase 2
// ============================================

const Storage = {
  getAll() {
    const data = localStorage.getItem(CONFIG.storageKey);
    return data ? JSON.parse(data) : [];
  },

  save(rendicion) {
    const all = this.getAll();
    rendicion.id = crypto.randomUUID();
    rendicion.created_at = new Date().toISOString();
    all.push(rendicion);
    localStorage.setItem(CONFIG.storageKey, JSON.stringify(all));
    return rendicion;
  },

  getFiltered({ localId, fechaDesde, fechaHasta, empleadoId, turno } = {}) {
    let data = this.getAll();

    if (localId) data = data.filter(r => r.local_id === localId);
    if (empleadoId) data = data.filter(r => r.empleado_id === empleadoId);
    if (turno) data = data.filter(r => r.turno === turno);
    if (fechaDesde) data = data.filter(r => r.fecha >= fechaDesde);
    if (fechaHasta) data = data.filter(r => r.fecha <= fechaHasta);

    return data.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  },

  delete(id) {
    const all = this.getAll().filter(r => r.id !== id);
    localStorage.setItem(CONFIG.storageKey, JSON.stringify(all));
  },

  update(id, updates) {
    const all = this.getAll();
    const idx = all.findIndex(r => r.id === id);
    if (idx !== -1) {
      all[idx] = { ...all[idx], ...updates };
      localStorage.setItem(CONFIG.storageKey, JSON.stringify(all));
      return all[idx];
    }
    return null;
  }
};
