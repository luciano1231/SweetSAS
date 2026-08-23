// ============================================
// OBLIGACIONES — Carga y tabla principal
// ============================================

(function () {
  'use strict';

  const ICON_PENCIL = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path></svg>';
  const ICON_CHECK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
  const ICON_X = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
  const ICON_TRASH = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';

  let movimientos = [];
  let obligacionesConocidas = [];

  // ============================================
  // CARGA DE DATOS
  // ============================================
  async function cargarObligacionesConocidas() {
    try {
      const res = await fetch('/api/obligaciones-referencias?tipo=general');
      const data = await res.json();
      if (!res.ok || !data.ok) return;
      obligacionesConocidas = data.referencias.map(r => r.obligacion);
      const datalist = document.getElementById('obligaciones-datalist');
      datalist.innerHTML = obligacionesConocidas.map(o => `<option value="${o.replace(/"/g, '&quot;')}">`).join('');
    } catch (e) { /* no crítico */ }
  }

  async function cargarMovimientos() {
    const params = new URLSearchParams();
    const desde = document.getElementById('filter-desde').value;
    const hasta = document.getElementById('filter-hasta').value;
    const banco = document.getElementById('filter-banco').value;
    const texto = document.getElementById('filter-texto').value.trim();
    const sinClasificar = document.getElementById('filter-sinclasificar').checked;

    if (desde) params.set('desde', desde);
    if (hasta) params.set('hasta', hasta);
    if (banco) params.set('banco', banco);
    if (texto) params.set('q', texto);
    if (sinClasificar) params.set('sinClasificar', '1');

    const wrapper = document.getElementById('table-wrapper');
    wrapper.innerHTML = '<div class="empty-state"><span class="empty-state__icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg></span><p class="empty-state__text">Cargando...</p></div>';

    try {
      const res = await fetch(`/api/obligaciones?${params.toString()}`);
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudieron cargar los movimientos.');
      movimientos = data.movimientos;
    } catch (err) {
      wrapper.innerHTML = `<div class="empty-state"><p class="empty-state__text">${err.message}</p></div>`;
      return;
    }

    renderTabla();
    renderKPIs();
  }

  // ============================================
  // RENDER
  // ============================================
  function renderKPIs() {
    const total = movimientos.reduce((s, m) => s + (m.monto || 0), 0);
    const sinClasificar = movimientos.filter(m => m.obligacion === 'SIN CLASIFICAR').length;
    document.getElementById('kpi-count').textContent = movimientos.length;
    document.getElementById('kpi-total').textContent = Utils.formatCurrency(total);
    document.getElementById('kpi-sinclasificar').textContent = sinClasificar;
  }

  function renderTabla() {
    const wrapper = document.getElementById('table-wrapper');

    if (movimientos.length === 0) {
      wrapper.innerHTML = `
        <div class="empty-state">
          <span class="empty-state__icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z"></path></svg></span>
          <h3 class="empty-state__title">No hay movimientos</h3>
          <p class="empty-state__text">Subí un resumen o cambiá los filtros.</p>
        </div>
      `;
      return;
    }

    let html = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Banco</th>
            <th>Obligación</th>
            <th>De Quien La Deuda</th>
            <th>Origen Del Dinero</th>
            <th>Monto</th>
            <th>Observación</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
    `;

    movimientos.forEach(m => {
      const esSinClasificar = m.obligacion === 'SIN CLASIFICAR';
      html += `
        <tr data-id="${m.id}">
          <td>${Utils.formatDate(m.fecha)}</td>
          <td>${m.banco}</td>
          <td class="cell-obligacion">
            <span class="cell-obligacion__view ${esSinClasificar ? 'obl-tag--sinclasificar' : ''}">${m.obligacion}</span>
            <button type="button" class="btn-row-delete btn-edit-obligacion" title="Reclasificar">${ICON_PENCIL}</button>
          </td>
          <td><input type="text" class="obl-inline-input" data-campo="de_quien_la_deuda" value="${(m.de_quien_la_deuda || '').replace(/"/g, '&quot;')}" placeholder="—"></td>
          <td><input type="text" class="obl-inline-input" data-campo="origen_del_dinero" value="${(m.origen_del_dinero || '').replace(/"/g, '&quot;')}" placeholder="—"></td>
          <td class="cell--currency">${Utils.formatCurrency(m.monto)}</td>
          <td title="${(m.observacion || '').replace(/"/g, '&quot;')}">${m.observacion || ''}</td>
          <td><button type="button" class="btn-row-delete btn-delete-mov" title="Eliminar">${ICON_TRASH}</button></td>
        </tr>
      `;
    });

    html += '</tbody></table>';
    wrapper.innerHTML = html;

    wrapper.querySelectorAll('.btn-edit-obligacion').forEach(btn => {
      btn.addEventListener('click', () => iniciarEdicionObligacion(btn.closest('tr')));
    });
    wrapper.querySelectorAll('.btn-delete-mov').forEach(btn => {
      btn.addEventListener('click', () => eliminarMovimiento(btn.closest('tr').dataset.id));
    });
    wrapper.querySelectorAll('.obl-inline-input').forEach(input => {
      input.addEventListener('change', () => guardarCampoSimple(input));
    });
  }

  // ============================================
  // EDICIÓN DE OBLIGACIÓN (dispara aprendizaje en el server)
  // ============================================
  function iniciarEdicionObligacion(tr) {
    const celda = tr.querySelector('.cell-obligacion');
    const valorActual = celda.querySelector('.cell-obligacion__view').textContent.trim();
    const valorInicial = valorActual === 'SIN CLASIFICAR' ? '' : valorActual;

    celda.innerHTML = `
      <input type="text" class="obl-inline-input" list="obligaciones-datalist" value="${valorInicial.replace(/"/g, '&quot;')}" placeholder="Buscar o escribir...">
      <button type="button" class="btn-row-delete btn-save-obligacion" title="Guardar">${ICON_CHECK}</button>
      <button type="button" class="btn-row-delete btn-cancel-obligacion" title="Cancelar">${ICON_X}</button>
    `;
    const input = celda.querySelector('input');
    input.focus();

    const guardar = () => guardarObligacion(tr, input.value.trim());
    celda.querySelector('.btn-save-obligacion').addEventListener('click', guardar);
    celda.querySelector('.btn-cancel-obligacion').addEventListener('click', () => renderTabla());
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') guardar();
      if (e.key === 'Escape') renderTabla();
    });
  }

  async function guardarObligacion(tr, nuevaObligacion) {
    if (!nuevaObligacion) { Utils.toast('Escribí o elegí una clasificación', 'error'); return; }
    const id = tr.dataset.id;
    try {
      const res = await fetch(`/api/obligaciones?id=${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ obligacion: nuevaObligacion }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo guardar.');
      Utils.toast('✓ Clasificación guardada — el sistema lo va a recordar', 'success');
      await cargarObligacionesConocidas();
      await cargarMovimientos();
    } catch (err) {
      Utils.toast('Error: ' + err.message, 'error');
    }
  }

  // ============================================
  // EDICIÓN DE CAMPOS SIMPLES (De Quien / Origen)
  // ============================================
  async function guardarCampoSimple(input) {
    const tr = input.closest('tr');
    const id = tr.dataset.id;
    const campo = input.dataset.campo;
    try {
      const res = await fetch(`/api/obligaciones?id=${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [campo]: input.value.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo guardar.');
    } catch (err) {
      Utils.toast('Error al guardar: ' + err.message, 'error');
    }
  }

  // ============================================
  // ELIMINAR
  // ============================================
  async function eliminarMovimiento(id) {
    const confirmado = await Utils.confirm('¿Eliminar movimiento?', 'Esta acción no se puede deshacer.', 'Eliminar');
    if (!confirmado) return;
    try {
      const res = await fetch(`/api/obligaciones?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo eliminar.');
      Utils.toast('Movimiento eliminado', 'success');
      await cargarMovimientos();
    } catch (err) {
      Utils.toast('Error: ' + err.message, 'error');
    }
  }

  // ============================================
  // SUBIR RESUMEN
  // ============================================

  // El botón cambia de color y de texto según el banco elegido, para que
  // sea visualmente obvio qué se va a procesar y minimizar el error de
  // subir un resumen con el banco equivocado seleccionado.
  const COLOR_GALICIA = { fondo: 'linear-gradient(135deg, #ff8a00, #e85d04)', sombra: '0 8px 24px rgba(232,93,4,0.35)' };
  const COLOR_MP = { fondo: 'linear-gradient(135deg, #00c2ff, #0089c7)', sombra: '0 8px 24px rgba(0,137,199,0.35)' };

  function actualizarBotonSegunBanco() {
    const banco = document.getElementById('banco').value;
    const btn = document.getElementById('btn-subir');
    const label = document.getElementById('btn-subir-label');
    const colores = banco === 'GALICIA' ? COLOR_GALICIA : COLOR_MP;

    btn.style.background = colores.fondo;
    btn.style.boxShadow = colores.sombra;
    label.textContent = banco === 'GALICIA' ? 'Procesar Galicia' : 'Procesar Mercado Pago';
  }

  async function handleUpload(e) {
    e.preventDefault();
    const banco = document.getElementById('banco').value;
    const archivoInput = document.getElementById('archivo');
    const archivo = archivoInput.files[0];

    if (!archivo) { Utils.toast('Elegí un archivo primero', 'error'); return; }

    const form = new FormData();
    form.append('banco', banco);
    form.append('archivo', archivo);

    const btn = document.getElementById('btn-subir');
    const label = document.getElementById('btn-subir-label');
    const textoOriginal = label.textContent;
    btn.disabled = true;
    label.textContent = 'Procesando...';

    try {
      const res = await fetch('/api/obligaciones-upload', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo procesar el archivo.');

      let msg = `✓ ${data.archivo}: ${data.insertadas} movimiento${data.insertadas !== 1 ? 's' : ''} nuevo${data.insertadas !== 1 ? 's' : ''}`;
      if (data.duplicadasOmitidas > 0) msg += `, ${data.duplicadasOmitidas} duplicado${data.duplicadasOmitidas !== 1 ? 's' : ''} omitido${data.duplicadasOmitidas !== 1 ? 's' : ''}`;
      if (data.sinClasificar > 0) msg += `, ${data.sinClasificar} sin clasificar`;
      Utils.toast(msg, data.sinClasificar > 0 ? 'warning' : 'success', 6000);

      archivoInput.value = '';
      await cargarObligacionesConocidas();
      await cargarMovimientos();
      await cargarHistorialCargas();
    } catch (err) {
      Utils.toast(err.message, 'error', 7000);
    } finally {
      btn.disabled = false;
      label.textContent = textoOriginal;
    }
  }

  // ============================================
  // HISTORIAL DE CARGAS (deshacer)
  // ============================================
  const ICON_UNDO = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>';

  async function cargarHistorialCargas() {
    try {
      const res = await fetch('/api/obligaciones-archivos');
      const data = await res.json();
      if (!res.ok || !data.ok) return;
      renderHistorialCargas(data.archivos);
    } catch (e) { /* no crítico */ }
  }

  function renderHistorialCargas(archivos) {
    const card = document.getElementById('historial-cargas-card');
    const list = document.getElementById('historial-cargas-list');

    if (archivos.length === 0) {
      card.style.display = 'none';
      return;
    }
    card.style.display = '';

    list.innerHTML = archivos.map(a => {
      const esGalicia = a.banco === 'Banco Galicia';
      const fecha = new Date(a.created_at).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      return `
        <div class="carga-row" data-id="${a.id}">
          <div class="carga-row__info">
            <span class="carga-row__banco ${esGalicia ? 'carga-row__banco--galicia' : 'carga-row__banco--mp'}">${a.banco}</span>
            <span class="carga-row__nombre">${a.nombre_archivo}</span>
            <span class="carga-row__meta">${a.filas_insertadas} movimiento${a.filas_insertadas !== 1 ? 's' : ''} · ${fecha}</span>
          </div>
          <button type="button" class="btn-deshacer" data-id="${a.id}" data-nombre="${a.nombre_archivo.replace(/"/g, '&quot;')}" data-filas="${a.filas_insertadas}">
            ${ICON_UNDO} Deshacer
          </button>
        </div>
      `;
    }).join('');

    list.querySelectorAll('.btn-deshacer').forEach(btn => {
      btn.addEventListener('click', () => deshacerCarga(btn.dataset.id, btn.dataset.nombre, btn.dataset.filas));
    });
  }

  async function deshacerCarga(id, nombre, filas) {
    const confirmado = await Utils.confirm(
      '¿Deshacer esta carga?',
      `Se van a eliminar los ${filas} movimiento${filas !== '1' ? 's' : ''} que vinieron de "${nombre}", y vas a poder volver a subir ese archivo. Esta acción no se puede deshacer.`,
      'Deshacer'
    );
    if (!confirmado) return;

    try {
      const res = await fetch(`/api/obligaciones-archivos?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo deshacer la carga.');
      Utils.toast(`✓ Carga deshecha: se eliminaron ${data.filasEliminadas} movimiento${data.filasEliminadas !== 1 ? 's' : ''}`, 'success');
      await cargarMovimientos();
      await cargarHistorialCargas();
      await cargarObligacionesConocidas();
    } catch (err) {
      Utils.toast('Error: ' + err.message, 'error');
    }
  }

  // ============================================
  // INIT
  // ============================================
  document.addEventListener('DOMContentLoaded', function () {
    window.sweetAuth.onReady(function () {
      document.getElementById('upload-form').addEventListener('submit', handleUpload);
      document.getElementById('banco').addEventListener('change', actualizarBotonSegunBanco);
      ['filter-desde', 'filter-hasta', 'filter-banco'].forEach(id => {
        document.getElementById(id).addEventListener('change', cargarMovimientos);
      });
      document.getElementById('filter-sinclasificar').addEventListener('change', cargarMovimientos);
      document.getElementById('filter-texto').addEventListener('input', Utils.debounce(cargarMovimientos, 300));

      actualizarBotonSegunBanco();
      cargarObligacionesConocidas();
      cargarMovimientos();
      cargarHistorialCargas();
    });
  });
})();
