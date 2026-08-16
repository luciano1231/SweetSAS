/* Sweet SAS Dashboard — Sección Rendiciones de Caja
   Reusa fmt()/fmtFull() y la config de Chart.defaults ya definidos en dashboard.js
   (este script se carga después, ver index.html). */
(function () {
  'use strict';

  const LOCALES = [
    { id: 'rissione', nombre: 'Sweet Rissione', color: '#3b82f6' },
    { id: 'hiper', nombre: 'Sweet Hiper', color: '#8b5cf6' },
    { id: 'changoMas', nombre: 'Sweet Chango Más', color: '#10b981' },
  ];

  const MEDIOS = [
    { key: 'total_efectivo', label: 'Efectivo', color: '#10b981' },
    { key: 'debito', label: 'Débito', color: '#3b82f6' },
    { key: 'credito', label: 'Crédito', color: '#8b5cf6' },
    { key: 'qr', label: 'QR', color: '#06b6d4' },
    { key: 'mp_point', label: 'Point', color: '#f59e0b' },
    { key: 'pedidos_ya', label: 'PedidosYa', color: '#ec4899' },
    { key: 'transferencia', label: 'Transferencia', color: '#eab308' },
  ];

  const MONTHS_ES_L = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const DIAS_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  let rendData = [];
  let rendCharts = {};
  let loaded = false;
  let requestSeq = 0; // evita que una respuesta vieja pise a una más nueva si cambian filtros rápido

  function localNombre(id) {
    const l = LOCALES.find(x => x.id === id);
    return l ? l.nombre : id;
  }

  function formatFecha(iso) {
    if (!iso) return '';
    const d = new Date(iso + 'T12:00:00');
    if (isNaN(d)) return iso;
    return `${DIAS_ES[d.getDay()]} ${d.getDate()}/${MONTHS_ES_L[d.getMonth()]}/${d.getFullYear()}`;
  }

  function mesLabel(iso) {
    const d = new Date(iso + 'T12:00:00');
    if (isNaN(d)) return iso;
    return MONTHS_ES[d.getMonth()] + ' ' + d.getFullYear();
  }

  function mesKey(iso) {
    return iso ? iso.slice(0, 7) : ''; // YYYY-MM
  }

  // ============================================
  // CARGA DE DATOS
  // ============================================
  async function loadRendiciones() {
    const params = new URLSearchParams();
    const local = document.getElementById('rendLocal').value;
    const turno = document.getElementById('rendTurno').value;
    const desde = document.getElementById('rendDesde').value;
    const hasta = document.getElementById('rendHasta').value;
    if (local) params.set('local', local);
    if (turno) params.set('turno', turno);
    if (desde) params.set('desde', desde);
    if (hasta) params.set('hasta', hasta);

    const tbody = document.getElementById('rendTableBody');
    tbody.innerHTML = '<tr><td style="padding:24px;color:var(--text-muted);">Cargando...</td></tr>';

    const mySeq = ++requestSeq;

    let data, error;
    try {
      const res = await fetch(`/api/rendiciones?${params.toString()}`);
      data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Error al cargar');
    } catch (err) {
      error = err;
    }

    // Si mientras esperábamos se disparó otro fetch más nuevo (otro cambio
    // de filtro), descartamos esta respuesta para no pisar la más reciente.
    if (mySeq !== requestSeq) return;

    if (error) {
      tbody.innerHTML = `<tr><td style="padding:24px;color:var(--accent-red);">No se pudo cargar: ${error.message}</td></tr>`;
      rendData = [];
    } else {
      rendData = data.rendiciones;
    }

    renderRendiciones();
  }

  // ============================================
  // KPIs
  // ============================================
  function renderKpis() {
    const sum = (k) => rendData.reduce((s, r) => s + (Number(r[k]) || 0), 0);
    document.getElementById('rendKpiEfectivo').textContent = fmtFull(sum('total_efectivo'));
    document.getElementById('rendKpiCount').textContent = `${rendData.length} turno${rendData.length !== 1 ? 's' : ''}`;
    document.getElementById('rendKpiReal').textContent = fmtFull(sum('total_real'));
    document.getElementById('rendKpiRegistrado').textContent = fmtFull(sum('registrado_sistema'));
    const dif = sum('diferencia');
    const difEl = document.getElementById('rendKpiDiferencia');
    difEl.textContent = fmtFull(dif);
    difEl.style.color = dif > 0 ? 'var(--accent-green)' : dif < 0 ? 'var(--accent-red)' : '';
  }

  // ============================================
  // GRÁFICOS
  // ============================================
  function destroyRendCharts() {
    Object.keys(rendCharts).forEach(k => { rendCharts[k].destroy(); delete rendCharts[k]; });
  }

  function renderCharts() {
    destroyRendCharts();

    // --- Evolución mensual: Total Real ---
    const mesesMap = {};
    rendData.forEach(r => {
      const k = mesKey(r.fecha);
      if (!k) return;
      mesesMap[k] = (mesesMap[k] || 0) + (Number(r.total_real) || 0);
    });
    const mesesKeys = Object.keys(mesesMap).sort();
    rendCharts.evolucion = new Chart(document.getElementById('chartRendEvolucion'), {
      type: 'bar',
      data: {
        labels: mesesKeys.map(k => mesLabel(k + '-01')),
        datasets: [{
          label: 'Total Real', data: mesesKeys.map(k => mesesMap[k]),
          backgroundColor: '#3b82f6cc', borderRadius: 6, barPercentage: .6,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          y: { ticks: { callback: v => fmt(v) }, grid: { color: 'rgba(255,255,255,0.04)' } },
          x: { grid: { display: false } },
        },
      },
    });

    // --- Medios de pago (donut) ---
    const totalesMedios = MEDIOS.map(m => rendData.reduce((s, r) => s + (Number(r[m.key]) || 0), 0));
    rendCharts.medios = new Chart(document.getElementById('chartRendMedios'), {
      type: 'doughnut',
      data: {
        labels: MEDIOS.map(m => m.label),
        datasets: [{ data: totalesMedios, backgroundColor: MEDIOS.map(m => m.color), borderWidth: 0, hoverOffset: 8 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '68%',
        plugins: { tooltip: { callbacks: { label: ctx => ctx.label + ': ' + fmtFull(ctx.raw) } } },
      },
    });

    // --- Comparativo por local ---
    const totalesLocal = LOCALES.map(l => rendData.filter(r => r.local_id === l.id).reduce((s, r) => s + (Number(r.total_real) || 0), 0));
    rendCharts.locales = new Chart(document.getElementById('chartRendLocales'), {
      type: 'bar',
      data: {
        labels: LOCALES.map(l => l.nombre),
        datasets: [{ label: 'Total Real', data: totalesLocal, backgroundColor: LOCALES.map(l => l.color + 'cc'), borderRadius: 6, barPercentage: .5 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { ticks: { callback: v => fmt(v) }, grid: { color: 'rgba(255,255,255,0.04)' } },
          x: { grid: { display: false } },
        },
      },
    });

    // --- Diferencias por mes ---
    const difMap = {};
    rendData.forEach(r => {
      const k = mesKey(r.fecha);
      if (!k) return;
      difMap[k] = (difMap[k] || 0) + (Number(r.diferencia) || 0);
    });
    const difKeys = Object.keys(difMap).sort();
    rendCharts.diferencias = new Chart(document.getElementById('chartRendDiferencias'), {
      type: 'bar',
      data: {
        labels: difKeys.map(k => mesLabel(k + '-01')),
        datasets: [{
          label: 'Diferencia', data: difKeys.map(k => difMap[k]),
          backgroundColor: difKeys.map(k => difMap[k] >= 0 ? '#10b981cc' : '#ef4444cc'), borderRadius: 6, barPercentage: .6,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { ticks: { callback: v => fmt(v) }, grid: { color: 'rgba(255,255,255,0.04)' } },
          x: { grid: { display: false } },
        },
      },
    });
  }

  // ============================================
  // TABLA
  // ============================================
  const RENDICIONES_COLS = [
    'Fecha', 'Local', 'Turno', 'Empleado', 'Efectivo', 'Débito', 'Crédito',
    'QR', 'Point', 'PedidosYa', 'Transf.', 'Total Real', 'Registrado', 'Diferencia', 'Obs.',
  ];

  function renderTable(filter = '') {
    document.getElementById('rendTableHead').innerHTML = RENDICIONES_COLS.map(c => `<th>${c}</th>`).join('');

    let data = rendData;
    if (filter) {
      const f = filter.toLowerCase();
      data = data.filter(r =>
        (r.local_nombre || '').toLowerCase().includes(f) ||
        (r.turno || '').toLowerCase().includes(f) ||
        (r.empleado_nombre || '').toLowerCase().includes(f)
      );
    }
    data = [...data].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '') || (b.created_at || '').localeCompare(a.created_at || ''));

    document.getElementById('rendTableBody').innerHTML = data.map(r => {
      const difColor = r.diferencia > 0 ? 'color:var(--accent-green);font-weight:700;' : r.diferencia < 0 ? 'color:var(--accent-red);font-weight:700;' : '';
      return `<tr>
        <td>${formatFecha(r.fecha)}</td>
        <td>${r.local_nombre || localNombre(r.local_id)}</td>
        <td>${r.turno}</td>
        <td>${r.empleado_nombre || '—'}</td>
        <td>${fmtFull(r.total_efectivo)}</td>
        <td>${fmtFull(r.debito)}</td>
        <td>${fmtFull(r.credito)}</td>
        <td>${fmtFull(r.qr)}</td>
        <td>${fmtFull(r.mp_point)}</td>
        <td>${fmtFull(r.pedidos_ya)}</td>
        <td>${fmtFull(r.transferencia)}</td>
        <td style="font-weight:700;">${fmtFull(r.total_real)}</td>
        <td>${fmtFull(r.registrado_sistema)}</td>
        <td style="${difColor}">${fmtFull(r.diferencia)}</td>
        <td title="${r.observaciones || ''}">${r.observaciones ? '📝' : ''}</td>
      </tr>`;
    }).join('');
  }

  function renderRendiciones() {
    renderKpis();
    renderCharts();
    renderTable(document.getElementById('rendTableSearch').value);
  }

  // ============================================
  // INIT
  // ============================================
  document.addEventListener('DOMContentLoaded', function () {
    // Default: últimos 30 días (igual que el historial de rendición)
    const hoy = new Date();
    const hace30 = new Date(hoy);
    hace30.setDate(hace30.getDate() - 30);
    document.getElementById('rendHasta').value = hoy.toISOString().split('T')[0];
    document.getElementById('rendDesde').value = hace30.toISOString().split('T')[0];

    // Cargar recién la primera vez que se abre la pestaña (evita pegarle a la
    // base de datos si el dueño nunca visita esta sección)
    const navItem = document.querySelector('[data-view="rendiciones"]');
    if (navItem) {
      navItem.addEventListener('click', () => {
        if (!loaded) { loaded = true; loadRendiciones(); }
      });
    }

    ['rendLocal', 'rendTurno', 'rendDesde', 'rendHasta'].forEach(id => {
      document.getElementById(id).addEventListener('change', loadRendiciones);
    });
    document.getElementById('rendResetFilters').addEventListener('click', () => {
      document.getElementById('rendLocal').value = '';
      document.getElementById('rendTurno').value = '';
      document.getElementById('rendDesde').value = hace30.toISOString().split('T')[0];
      document.getElementById('rendHasta').value = hoy.toISOString().split('T')[0];
      loadRendiciones();
    });
    document.getElementById('rendTableSearch').addEventListener('input', e => renderTable(e.target.value));
  });
})();
