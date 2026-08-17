// ============================================
// LÓGICA DEL HISTORIAL (Planilla Maestra)
// ============================================

(function () {
  'use strict';

  // Locales a los que este usuario tiene acceso (se completa antes de init(),
  // ver el final del archivo). Se usa tanto para restringir el <select> como
  // para filtrar los datos, sin depender de lo que haya seleccionado en el UI.
  let permittedLocales = [];

  // ============================================
  // INITIALIZATION
  // ============================================

  function init() {
    populateFilters();
    bindEvents();
    renderTable(); // async, no need to await acá
  }

  // --- Populate filter dropdowns ---
  function populateFilters() {
    // Locales — solo los que este usuario puede ver
    const localSelect = document.getElementById('filter-local');
    const localesVisibles = CONFIG.locales.filter(l => permittedLocales.includes(l.id));

    localesVisibles.forEach(local => {
      const opt = document.createElement('option');
      opt.value = local.id;
      opt.textContent = local.nombre;
      localSelect.appendChild(opt);
    });

    if (localesVisibles.length === 1) {
      // Un solo local permitido: fijarlo y no dejar elegir "todos"
      localSelect.querySelector('option[value=""]').remove();
      localSelect.value = localesVisibles[0].id;
      localSelect.disabled = true;
    }

    // Turnos
    const turnoSelect = document.getElementById('filter-turno');
    CONFIG.turnos.forEach(turno => {
      const opt = document.createElement('option');
      opt.value = turno;
      opt.textContent = turno;
      turnoSelect.appendChild(opt);
    });

    // Fecha defaults: last 30 days
    const today = new Date();
    const thirtyAgo = new Date(today);
    thirtyAgo.setDate(thirtyAgo.getDate() - 30);
    
    document.getElementById('filter-hasta').value = Utils.today();
    document.getElementById('filter-desde').value = thirtyAgo.toISOString().split('T')[0];
  }

  // ============================================
  // EVENT BINDINGS
  // ============================================

  function bindEvents() {
    // Filters
    ['filter-local', 'filter-turno', 'filter-desde', 'filter-hasta'].forEach(id => {
      document.getElementById(id).addEventListener('change', renderTable);
    });

    // Export
    document.getElementById('btn-export').addEventListener('click', exportCSV);
  }

  // ============================================
  // GET FILTERED DATA
  // ============================================

  async function getFilteredData() {
    const filters = {
      localId: document.getElementById('filter-local').value || undefined,
      turno: document.getElementById('filter-turno').value || undefined,
      fechaDesde: document.getElementById('filter-desde').value || undefined,
      fechaHasta: document.getElementById('filter-hasta').value || undefined,
    };
    const data = await Storage.getFiltered(filters);
    // Reforzar el scoping por permisos acá también, sin depender de lo que
    // haya seleccionado el <select> (por si lo manipulan desde devtools).
    return data.filter(r => permittedLocales.includes(r.local_id));
  }

  // ============================================
  // RENDER TABLE
  // ============================================

  async function renderTable() {
    const wrapper = document.getElementById('table-wrapper');
    wrapper.innerHTML = '<div class="empty-state"><span class="empty-state__icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg></span><p class="empty-state__text">Cargando...</p></div>';

    let data;
    try {
      data = await getFilteredData();
    } catch (err) {
      wrapper.innerHTML = `
        <div class="empty-state">
          <span class="empty-state__icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg></span>
          <h3 class="empty-state__title">No se pudo cargar el historial</h3>
          <p class="empty-state__text">${err.message}</p>
        </div>
      `;
      document.getElementById('totals-card').style.display = 'none';
      return;
    }

    if (data.length === 0) {
      wrapper.innerHTML = `
        <div class="empty-state">
          <span class="empty-state__icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z"></path></svg></span>
          <h3 class="empty-state__title">No hay rendiciones</h3>
          <p class="empty-state__text">No se encontraron rendiciones con los filtros seleccionados</p>
        </div>
      `;
      document.getElementById('totals-card').style.display = 'none';
      return;
    }

    // Build table
    let html = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Local</th>
            <th>Turno</th>
            <th>Empleado</th>
            <th>Efectivo</th>
            <th>Débito</th>
            <th>Crédito</th>
            <th>QR</th>
            <th>Point</th>
            <th>PedidosYa</th>
            <th>Transf.</th>
            <th>Total Real</th>
            <th>Registrado</th>
            <th>Diferencia</th>
            <th>Obs.</th>
          </tr>
        </thead>
        <tbody>
    `;

    data.forEach(r => {
      const diffClass = r.diferencia > 0 ? 'cell--positive' : r.diferencia < 0 ? 'cell--negative' : '';
      const turnoClass = r.turno === 'Mañana' ? 'badge--morning' : r.turno === 'Tarde' ? 'badge--afternoon' : 'badge--night';

      html += `
        <tr>
          <td>${Utils.formatDate(r.fecha)}</td>
          <td>${r.local_nombre || Utils.getLocalName(r.local_id)}</td>
          <td><span class="badge ${turnoClass}">${r.turno}</span></td>
          <td>${r.empleado_nombre || Utils.getEmpleadoName(r.empleado_id)}</td>
          <td class="cell--currency">${Utils.formatCurrency(r.total_efectivo)}</td>
          <td class="cell--currency">${Utils.formatCurrency(r.debito || 0)}</td>
          <td class="cell--currency">${Utils.formatCurrency(r.credito || 0)}</td>
          <td class="cell--currency">${Utils.formatCurrency(r.qr || 0)}</td>
          <td class="cell--currency">${Utils.formatCurrency(r.mp_point || 0)}</td>
          <td class="cell--currency">${Utils.formatCurrency(r.pedidos_ya || 0)}</td>
          <td class="cell--currency">${Utils.formatCurrency(r.transferencia || 0)}</td>
          <td class="cell--currency" style="font-weight:600;">${Utils.formatCurrency(r.total_real)}</td>
          <td class="cell--currency">${Utils.formatCurrency(r.registrado_sistema)}</td>
          <td class="cell--currency ${diffClass}">${Utils.formatCurrency(r.diferencia)}</td>
          <td title="${r.observaciones || ''}">${r.observaciones ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><line x1="10" y1="9" x2="8" y2="9"></line></svg>' : ''}</td>
        </tr>
      `;
    });

    html += '</tbody></table>';
    wrapper.innerHTML = html;

    // Update totals
    updateTotals(data);
  }

  // ============================================
  // UPDATE SUMMARY TOTALS
  // ============================================

  function updateTotals(data) {
    const totalsCard = document.getElementById('totals-card');
    totalsCard.style.display = 'block';

    const sumEfectivo = data.reduce((s, r) => s + (r.total_efectivo || 0), 0);
    const sumTotalReal = data.reduce((s, r) => s + (r.total_real || 0), 0);
    const sumRegistrado = data.reduce((s, r) => s + (r.registrado_sistema || 0), 0);
    const sumDiferencia = data.reduce((s, r) => s + (r.diferencia || 0), 0);

    document.getElementById('totals-count').textContent = `${data.length} rendicion${data.length !== 1 ? 'es' : ''}`;
    document.getElementById('sum-efectivo').textContent = Utils.formatCurrency(sumEfectivo);
    document.getElementById('sum-total-real').textContent = Utils.formatCurrency(sumTotalReal);
    document.getElementById('sum-registrado').textContent = Utils.formatCurrency(sumRegistrado);
    document.getElementById('sum-diferencia').textContent = Utils.formatCurrency(sumDiferencia);

    // Difference row styling
    const diffRow = document.getElementById('sum-diff-row');
    diffRow.classList.remove('summary-row--positive', 'summary-row--negative', 'summary-row--zero');
    if (sumDiferencia > 0) diffRow.classList.add('summary-row--positive');
    else if (sumDiferencia < 0) diffRow.classList.add('summary-row--negative');
    else diffRow.classList.add('summary-row--zero');
  }

  // ============================================
  // EXPORT TO CSV
  // ============================================

  async function exportCSV() {
    let data;
    try {
      data = await getFilteredData();
    } catch (err) {
      Utils.toast('No se pudieron cargar los datos: ' + err.message, 'error');
      return;
    }

    if (data.length === 0) {
      Utils.toast('No hay datos para exportar', 'warning');
      return;
    }

    // CSV headers
    const headers = [
      'Fecha', 'Local', 'Turno', 'Empleado',
      'Billetes $10', 'Billetes $20', 'Billetes $50',
      'Billetes $100', 'Billetes $200', 'Billetes $500',
      'Billetes $1.000', 'Billetes $2.000', 'Billetes $10.000', 'Billetes $20.000',
      'Total Efectivo',
      'Débito', 'Crédito', 'QR', 'MercadoPago Point', 'PedidosYa', 'Transferencia',
      'Total Real', 'Registrado en Sistema', 'Diferencia',
      'Observaciones'
    ];

    const rows = data.map(r => [
      r.fecha,
      r.local_nombre || Utils.getLocalName(r.local_id),
      r.turno,
      r.empleado_nombre || Utils.getEmpleadoName(r.empleado_id),
      r.billetes_10 || 0, r.billetes_20 || 0, r.billetes_50 || 0,
      r.billetes_100 || 0, r.billetes_200 || 0, r.billetes_500 || 0,
      r.billetes_1000 || 0, r.billetes_2000 || 0, r.billetes_10000 || 0, r.billetes_20000 || 0,
      r.total_efectivo || 0,
      r.debito || 0, r.credito || 0, r.qr || 0,
      r.mp_point || 0, r.pedidos_ya || 0, r.transferencia || 0,
      r.total_real || 0, r.registrado_sistema || 0, r.diferencia || 0,
      `"${(r.observaciones || '').replace(/"/g, '""')}"`
    ]);

    // Build CSV
    const BOM = '\uFEFF'; // UTF-8 BOM for Excel
    const csvContent = BOM + [
      headers.join(';'),
      ...rows.map(row => row.join(';'))
    ].join('\n');

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rendiciones_${Utils.today()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    Utils.toast(`Exportado: ${data.length} rendiciones`, 'success');
  }

  // ============================================
  // INIT
  // ============================================

  document.addEventListener('DOMContentLoaded', function () {
    window.sweetAuth.onReady(function (session) {
      permittedLocales = (session.permissions && session.permissions.locales) || [];
      init();
    });
  });
})();
