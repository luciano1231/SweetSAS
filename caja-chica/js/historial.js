// ============================================
// CAJA CHICA — Historial (Planilla Maestra)
// ============================================

(function () {
  'use strict';

  let permittedLocales = [];

  function init() {
    populateFilters();
    bindEvents();
    renderTable();
  }

  function populateFilters() {
    const localSelect = document.getElementById('filter-local');
    const localesVisibles = CONFIG.locales.filter(l => permittedLocales.includes(l.id));

    localesVisibles.forEach(local => {
      const opt = document.createElement('option');
      opt.value = local.id;
      opt.textContent = local.nombre;
      localSelect.appendChild(opt);
    });

    if (localesVisibles.length > 0) localSelect.value = localesVisibles[0].id;
    if (localesVisibles.length === 1) localSelect.disabled = true;

    const clasifSelect = document.getElementById('filter-clasificacion');
    CONFIG.clasificaciones.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      clasifSelect.appendChild(opt);
    });

    const today = new Date();
    const thirtyAgo = new Date(today);
    thirtyAgo.setDate(thirtyAgo.getDate() - 30);
    document.getElementById('filter-hasta').value = Utils.today();
    document.getElementById('filter-desde').value = thirtyAgo.toISOString().split('T')[0];
  }

  function bindEvents() {
    ['filter-local', 'filter-clasificacion', 'filter-desde', 'filter-hasta'].forEach(id => {
      document.getElementById(id).addEventListener('change', renderTable);
    });
    document.getElementById('filter-texto').addEventListener('input', Utils.debounce(renderTable, 250));
    document.getElementById('btn-export').addEventListener('click', exportCSV);
  }

  function currentLocalId() {
    const val = document.getElementById('filter-local').value;
    return permittedLocales.includes(val) ? val : (permittedLocales[0] || null);
  }

  async function getFilteredData() {
    const localId = currentLocalId();
    if (!localId) return [];

    const data = await Storage.listar({
      localId,
      estado: 'enviado',
      clasificacion: document.getElementById('filter-clasificacion').value || undefined,
      desde: document.getElementById('filter-desde').value || undefined,
      hasta: document.getElementById('filter-hasta').value || undefined,
      q: document.getElementById('filter-texto').value.trim() || undefined,
    });
    return data;
  }

  // Saldo actual real del local (sin los filtros de fecha/clasificación/texto,
  // que solo afectan lo que se muestra en la tabla).
  async function getSaldoActual() {
    const localId = currentLocalId();
    if (!localId) return 0;
    const data = await Storage.listar({ localId, estado: 'enviado' });
    return data.length > 0 ? data[0].saldo : 0; // ya viene ordenado más reciente primero
  }

  async function renderTable() {
    const wrapper = document.getElementById('table-wrapper');
    wrapper.innerHTML = '<div class="empty-state"><span class="empty-state__icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg></span><p class="empty-state__text">Cargando...</p></div>';

    let data, saldoActual;
    try {
      [data, saldoActual] = await Promise.all([getFilteredData(), getSaldoActual()]);
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
          <h3 class="empty-state__title">No hay movimientos</h3>
          <p class="empty-state__text">No se encontraron movimientos con los filtros seleccionados</p>
        </div>
      `;
      document.getElementById('totals-card').style.display = 'none';
      return;
    }

    let html = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Ítem</th>
            <th>Clasificación</th>
            <th>Detalle</th>
            <th>Ingreso</th>
            <th>Egreso</th>
            <th>Saldo</th>
          </tr>
        </thead>
        <tbody>
    `;

    data.forEach(m => {
      html += `
        <tr>
          <td>${Utils.formatDate(m.fecha)}</td>
          <td>${m.item}</td>
          <td><span class="clasificacion-tag">${m.clasificacion}</span></td>
          <td title="${m.detalle || ''}">${m.detalle || ''}</td>
          <td class="cell--currency cell--ingreso">${m.ingreso ? Utils.formatCurrency(m.ingreso) : ''}</td>
          <td class="cell--currency cell--egreso">${m.egreso ? Utils.formatCurrency(m.egreso) : ''}</td>
          <td class="cell--currency cell--saldo">${Utils.formatCurrency(m.saldo)}</td>
        </tr>
      `;
    });

    html += '</tbody></table>';
    wrapper.innerHTML = html;

    updateTotals(data, saldoActual);
  }

  function updateTotals(data, saldoActual) {
    const totalsCard = document.getElementById('totals-card');
    totalsCard.style.display = 'block';

    const sumIngresos = data.reduce((s, m) => s + (m.ingreso || 0), 0);
    const sumEgresos = data.reduce((s, m) => s + (m.egreso || 0), 0);

    document.getElementById('totals-count').textContent = `${data.length} movimiento${data.length !== 1 ? 's' : ''}`;
    document.getElementById('sum-ingresos').textContent = Utils.formatCurrency(sumIngresos);
    document.getElementById('sum-egresos').textContent = Utils.formatCurrency(sumEgresos);
    document.getElementById('sum-saldo-actual').textContent = Utils.formatCurrency(saldoActual);
  }

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

    const headers = ['Fecha', 'Local', 'Ítem', 'Clasificación', 'Detalle', 'Ingreso', 'Egreso', 'Saldo'];
    const rows = data.map(m => [
      m.fecha,
      m.local_nombre || Utils.getLocalName(m.local_id),
      m.item,
      m.clasificacion,
      `"${(m.detalle || '').replace(/"/g, '""')}"`,
      m.ingreso || 0,
      m.egreso || 0,
      m.saldo || 0,
    ]);

    const BOM = '﻿';
    const csvContent = BOM + [headers.join(';'), ...rows.map(row => row.join(';'))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `caja_chica_${Utils.today()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    Utils.toast(`Exportado: ${data.length} movimientos`, 'success');
  }

  document.addEventListener('DOMContentLoaded', function () {
    window.sweetAuth.onReady(function (session) {
      permittedLocales = (session.permissions && session.permissions.locales) || [];
      init();
    });
  });
})();
