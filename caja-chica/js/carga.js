// ============================================
// CAJA CHICA — Carga de movimientos (planilla de trabajo del local)
// ============================================

(function () {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  const localId = params.get('local');

  if (!localId) {
    window.location.href = 'index.html';
    return;
  }

  const local = CONFIG.locales.find(l => l.id === localId);
  if (!local) {
    window.location.href = 'index.html';
    return;
  }

  let userName = '';
  window.sweetAuth.onReady(function (session) {
    const permitidos = (session.permissions && session.permissions.locales) || [];
    if (!permitidos.includes(localId)) {
      window.location.href = 'index.html';
      return;
    }
    userName = session.userName || '';
  });

  document.getElementById('header-local').textContent = local.nombre;
  document.title = `Caja Chica — ${local.nombre}`;

  let direction = 'ingreso'; // 'ingreso' | 'egreso'
  let pendientes = [];

  const ICON_TRASH = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';

  // ============================================
  // INICIALIZACIÓN
  // ============================================

  function init() {
    populateItems();
    setFechaHoy();
    bindEvents();
    loadPendientes();
  }

  function populateItems() {
    const select = document.getElementById('item');
    CONFIG.clasificaciones.forEach(clasif => {
      const items = CONFIG.itemsCajaChica.filter(i => i.clasificacion === clasif);
      if (items.length === 0) return;
      const group = document.createElement('optgroup');
      group.label = clasif;
      items.forEach(i => {
        const opt = document.createElement('option');
        opt.value = i.item;
        opt.textContent = i.item;
        opt.dataset.clasificacion = i.clasificacion;
        group.appendChild(opt);
      });
      select.appendChild(group);
    });
  }

  function setFechaHoy() {
    document.getElementById('fecha').value = Utils.today();
    updateFechaDisplay();
  }

  function updateFechaDisplay() {
    const fecha = document.getElementById('fecha').value;
    document.getElementById('fecha-display').textContent = fecha ? Utils.formatDate(fecha) : '';
  }

  function setDirection(dir) {
    direction = dir;
    document.getElementById('btn-ingreso').classList.toggle('is-active', dir === 'ingreso');
    document.getElementById('btn-egreso').classList.toggle('is-active', dir === 'egreso');
  }

  // ============================================
  // EVENTOS
  // ============================================

  function bindEvents() {
    document.getElementById('fecha').addEventListener('change', updateFechaDisplay);

    document.getElementById('btn-ingreso').addEventListener('click', () => setDirection('ingreso'));
    document.getElementById('btn-egreso').addEventListener('click', () => setDirection('egreso'));

    // Al elegir un ítem, sugerir el sentido más probable (el usuario puede cambiarlo igual)
    document.getElementById('item').addEventListener('change', (e) => {
      const val = e.target.value;
      if (CONFIG.itemsTipicamenteIngreso.includes(val)) setDirection('ingreso');
      else if (val) setDirection('egreso');
    });

    document.getElementById('mov-form').addEventListener('submit', handleSubmit);
    document.getElementById('btn-cerrar').addEventListener('click', handleCerrar);
  }

  // ============================================
  // CARGAR / RENDERIZAR PENDIENTES
  // ============================================

  async function loadPendientes() {
    const wrapper = document.getElementById('table-wrapper');
    try {
      pendientes = await Storage.listar({ localId, estado: 'pendiente' });
    } catch (err) {
      wrapper.innerHTML = `<div class="empty-state"><p class="empty-state__text">${err.message}</p></div>`;
      return;
    }
    renderTable();
    renderSaldo();
  }

  function renderTable() {
    const wrapper = document.getElementById('table-wrapper');
    const count = document.getElementById('pendientes-count');

    if (pendientes.length === 0) {
      wrapper.innerHTML = `
        <div class="empty-state">
          <span class="empty-state__icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z"></path></svg></span>
          <h3 class="empty-state__title">Sin movimientos pendientes</h3>
          <p class="empty-state__text">Cargá el primer ingreso o gasto con el formulario de arriba.</p>
        </div>
      `;
      count.textContent = 'Todavía sin movimientos cargados';
      return;
    }

    count.textContent = `${pendientes.length} movimiento${pendientes.length !== 1 ? 's' : ''} sin enviar`;

    // Orden cronológico (más antiguo primero, como se van a enviar)
    const ordenados = [...pendientes].sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));

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
            <th></th>
          </tr>
        </thead>
        <tbody>
    `;
    ordenados.forEach(m => {
      html += `
        <tr>
          <td>${Utils.formatDate(m.fecha)}</td>
          <td>${m.item}</td>
          <td><span class="clasificacion-tag">${m.clasificacion}</span></td>
          <td title="${m.detalle || ''}">${m.detalle || ''}</td>
          <td class="cell--currency cell--ingreso">${m.ingreso ? Utils.formatCurrency(m.ingreso) : ''}</td>
          <td class="cell--currency cell--egreso">${m.egreso ? Utils.formatCurrency(m.egreso) : ''}</td>
          <td><button type="button" class="btn-row-delete" data-id="${m.id}" title="Eliminar">${ICON_TRASH}</button></td>
        </tr>
      `;
    });
    html += '</tbody></table>';
    wrapper.innerHTML = html;

    wrapper.querySelectorAll('.btn-row-delete').forEach(btn => {
      btn.addEventListener('click', () => handleDelete(btn.dataset.id));
    });
  }

  function renderSaldo() {
    const totalIngreso = pendientes.reduce((s, m) => s + (m.ingreso || 0), 0);
    const totalEgreso = pendientes.reduce((s, m) => s + (m.egreso || 0), 0);
    const saldo = Math.round((totalIngreso - totalEgreso) * 100) / 100;

    document.getElementById('saldo-ingresos').textContent = Utils.formatCurrency(totalIngreso);
    document.getElementById('saldo-egresos').textContent = Utils.formatCurrency(totalEgreso);
    document.getElementById('saldo-total').textContent = Utils.formatCurrency(saldo);

    const banner = document.getElementById('saldo-banner');
    const hint = document.getElementById('saldo-hint');
    const btnCerrar = document.getElementById('btn-cerrar');
    const balanced = Math.abs(saldo) < 0.5;

    banner.classList.toggle('saldo-banner--balanced', balanced);
    banner.classList.toggle('saldo-banner--unbalanced', !balanced);

    if (pendientes.length === 0) {
      hint.textContent = '';
      btnCerrar.disabled = true;
    } else if (balanced) {
      hint.textContent = 'Saldo en $0 — listo para enviar.';
      btnCerrar.disabled = false;
    } else {
      const accion = saldo > 0 ? 'devolver' : 'reponer';
      hint.textContent = `Para enviar, el saldo tiene que quedar en $0. Cargá un movimiento de "Devolución Saldo de caja chica" (o el que corresponda) para ${accion} la diferencia.`;
      btnCerrar.disabled = true;
    }
  }

  // ============================================
  // AGREGAR MOVIMIENTO
  // ============================================

  async function handleSubmit(e) {
    e.preventDefault();

    const fecha = document.getElementById('fecha').value;
    const itemSelect = document.getElementById('item');
    const item = itemSelect.value;
    const clasificacion = itemSelect.selectedOptions[0]?.dataset.clasificacion || '';
    const detalle = document.getElementById('detalle').value.trim();
    const monto = Math.max(0, Number(document.getElementById('monto').value) || 0);

    if (!fecha || !item || !monto) {
      Utils.toast('Completá fecha, ítem y un monto mayor a $0', 'error');
      return;
    }

    const mov = {
      local_id: localId,
      local_nombre: local.nombre,
      fecha,
      item,
      clasificacion,
      detalle,
      ingreso: direction === 'ingreso' ? monto : 0,
      egreso: direction === 'egreso' ? monto : 0,
      creado_por: userName,
    };

    const btn = document.getElementById('btn-agregar');
    btn.disabled = true;
    try {
      await Storage.crear(mov);
      Utils.toast('✓ Movimiento agregado', 'success');
      resetForm();
      await loadPendientes();
    } catch (err) {
      Utils.toast('Error al guardar: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  }

  function resetForm() {
    document.getElementById('item').value = '';
    document.getElementById('detalle').value = '';
    document.getElementById('monto').value = '';
    setDirection('ingreso');
    setFechaHoy();
  }

  // ============================================
  // ELIMINAR MOVIMIENTO
  // ============================================

  async function handleDelete(id) {
    const confirmed = await Utils.confirm('¿Eliminar movimiento?', 'Esta acción no se puede deshacer.', 'Eliminar');
    if (!confirmed) return;
    try {
      await Storage.eliminar(id);
      Utils.toast('Movimiento eliminado', 'success');
      await loadPendientes();
    } catch (err) {
      Utils.toast('Error al eliminar: ' + err.message, 'error');
    }
  }

  // ============================================
  // CERRAR CAJA
  // ============================================

  async function handleCerrar() {
    const totalIngreso = pendientes.reduce((s, m) => s + (m.ingreso || 0), 0);
    const totalEgreso = pendientes.reduce((s, m) => s + (m.egreso || 0), 0);

    const confirmed = await Utils.confirm(
      '¿Cerrar caja y enviar?',
      `Se van a enviar ${pendientes.length} movimiento${pendientes.length !== 1 ? 's' : ''} a la planilla maestra de ${local.nombre}.<br><br>Ingresos: ${Utils.formatCurrency(totalIngreso)}<br>Egresos: ${Utils.formatCurrency(totalEgreso)}`,
      'Enviar'
    );
    if (!confirmed) return;

    const btn = document.getElementById('btn-cerrar');
    btn.disabled = true;
    try {
      const res = await Storage.cerrarCaja(localId, local.nombre);
      Utils.toast(`✓ Caja enviada: ${res.enviados} movimiento${res.enviados !== 1 ? 's' : ''}`, 'success');
      await loadPendientes();
    } catch (err) {
      Utils.toast(err.message, 'error');
      btn.disabled = false;
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
