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
      document.getElementById('efectivo-local-card').style.display = 'none';
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
      document.getElementById('efectivo-local-card').style.display = 'none';
      return;
    }

    // Detectar rendiciones dobles: mismo local + fecha + turno más de una vez.
    const grupos = {};
    data.forEach(r => {
      const k = `${r.local_id}|${r.fecha}|${r.turno}`;
      (grupos[k] = grupos[k] || []).push(r);
    });
    const esDuplicada = r => grupos[`${r.local_id}|${r.fecha}|${r.turno}`].length > 1;
    const gruposDobles = Object.values(grupos).filter(g => g.length > 1);

    let html = '';
    if (gruposDobles.length > 0) {
      const items = gruposDobles.map(g => {
        const r = g[0];
        return `<li><strong>${r.local_nombre || Utils.getLocalName(r.local_id)}</strong> — ${Utils.formatDate(r.fecha)} — ${r.turno} (${g.length} cargas)</li>`;
      }).join('');
      html += `
        <div class="dup-banner" style="background:#fef3c7;border:1px solid #f59e0b;color:#78350f;border-radius:8px;padding:12px 16px;margin-bottom:12px;">
          <strong>⚠️ ${gruposDobles.length} turno${gruposDobles.length !== 1 ? 's' : ''} con rendición duplicada.</strong>
          Esto suma ingresos de más en el balance. Eliminá la que sobra con el ícono del tacho:
          <ul style="margin:8px 0 0 18px;">${items}</ul>
        </div>
      `;
    }

    // Build table
    html += `
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
            <th></th>
          </tr>
        </thead>
        <tbody>
    `;

    data.forEach(r => {
      const diffClass = r.diferencia > 0 ? 'cell--positive' : r.diferencia < 0 ? 'cell--negative' : '';
      const turnoClass = r.turno === 'Mañana' ? 'badge--morning' : r.turno === 'Tarde' ? 'badge--afternoon' : 'badge--night';

      const dup = esDuplicada(r);
      html += `
        <tr${dup ? ' style="background:rgba(245,158,11,.15);"' : ''}>
          <td>${Utils.formatDate(r.fecha)}${dup ? ' <span class="badge" style="background:#f59e0b;color:#fff;" title="Hay más de una rendición para este local, fecha y turno">Duplicada</span>' : ''}</td>
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
          <td class="cell--actions">
            <a href="carga.html?local=${encodeURIComponent(r.local_id)}&id=${encodeURIComponent(r.id)}" class="btn-row-icon" title="Editar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path></svg></a>
            <button type="button" class="btn-row-icon btn-row-icon--danger btn-delete-rendicion" data-id="${r.id}" title="Eliminar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
          </td>
        </tr>
      `;
    });

    html += '</tbody></table>';
    wrapper.innerHTML = html;

    wrapper.querySelectorAll('.btn-delete-rendicion').forEach(btn => {
      btn.addEventListener('click', () => eliminarRendicion(btn.dataset.id));
    });

    // Update totals
    updateTotals(data);
    updateEfectivoPorLocal(data);
  }

  // ============================================
  // EFECTIVO POR LOCAL (en el rango filtrado)
  // ============================================

  function updateEfectivoPorLocal(data) {
    const card = document.getElementById('efectivo-local-card');
    card.style.display = 'block';

    const porLocal = {};
    data.forEach(r => {
      const k = r.local_id;
      if (!porLocal[k]) porLocal[k] = { nombre: r.local_nombre || Utils.getLocalName(r.local_id), efectivo: 0, cantidad: 0 };
      porLocal[k].efectivo += r.total_efectivo || 0;
      porLocal[k].cantidad += 1;
    });
    const filas = Object.values(porLocal).sort((a, b) => b.efectivo - a.efectivo);
    const total = filas.reduce((s, f) => s + f.efectivo, 0);

    const desde = document.getElementById('filter-desde').value;
    const hasta = document.getElementById('filter-hasta').value;
    const turno = document.getElementById('filter-turno').value;
    let rango = desde && hasta ? `Del ${Utils.formatDate(desde)} al ${Utils.formatDate(hasta)}`
      : desde ? `Desde el ${Utils.formatDate(desde)}`
      : hasta ? `Hasta el ${Utils.formatDate(hasta)}`
      : 'Todas las fechas';
    if (turno) rango += ` — turno ${turno}`;
    document.getElementById('efectivo-local-rango').textContent = rango;

    let html = filas.map(f => `
      <div class="summary-row summary-row--subtotal">
        <span class="summary-row__label">${f.nombre} <span style="color: var(--text-muted); font-weight: 400;">(${f.cantidad} rendicion${f.cantidad !== 1 ? 'es' : ''})</span></span>
        <span class="summary-row__value">${Utils.formatCurrency(f.efectivo)}</span>
      </div>
    `).join('');
    if (filas.length > 1) {
      html += `
        <div class="summary-row summary-row--total">
          <span class="summary-row__label">Total Efectivo</span>
          <span class="summary-row__value">${Utils.formatCurrency(total)}</span>
        </div>
      `;
    }
    document.getElementById('efectivo-local-list').innerHTML = html;
  }

  // ============================================
  // ELIMINAR UNA RENDICIÓN
  // ============================================

  async function eliminarRendicion(id) {
    const confirmado = await Utils.confirm(
      '¿Eliminar esta rendición?',
      'Esta acción no se puede deshacer.',
      'Eliminar'
    );
    if (!confirmado) return;
    try {
      await Storage.delete(id);
      Utils.toast('Rendición eliminada', 'success');
      renderTable();
    } catch (err) {
      Utils.toast(err.message, 'error');
    }
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
