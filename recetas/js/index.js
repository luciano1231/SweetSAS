// ============================================
// RECETAS — Listado de Productos
// ============================================

(function () {
  'use strict';

  const ICON_TRASH = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
  const ICON_CHECK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
  const ICON_X = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';

  let todosLosProductos = [];

  async function cargarProductos() {
    const wrapper = document.getElementById('table-wrapper');
    wrapper.innerHTML = '<div class="empty-state"><span class="empty-state__icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg></span><p class="empty-state__text">Cargando...</p></div>';

    try {
      const res = await window.sweetAuth.fetch('/api/recetas');
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudieron cargar los productos.');
      todosLosProductos = data.productos;
    } catch (err) {
      wrapper.innerHTML = `<div class="empty-state"><p class="empty-state__text">${err.message}</p></div>`;
      return;
    }

    renderTabla();
  }

  function renderTabla() {
    const wrapper = document.getElementById('table-wrapper');
    const mostrarDeshabilitados = document.getElementById('filter-deshabilitados').checked;
    const productos = mostrarDeshabilitados ? todosLosProductos : todosLosProductos.filter(p => p.activo !== 0);

    if (todosLosProductos.length === 0) {
      wrapper.innerHTML = `
        <div class="empty-state">
          <span class="empty-state__icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z"></path></svg></span>
          <h3 class="empty-state__title">Todavía no hay productos</h3>
          <p class="empty-state__text">Creá el primero arriba.</p>
        </div>
      `;
      return;
    }

    if (productos.length === 0) {
      wrapper.innerHTML = `
        <div class="empty-state">
          <p class="empty-state__text">No hay productos habilitados. Tildá "Mostrar deshabilitados" arriba para verlos.</p>
        </div>
      `;
      return;
    }

    let html = `
      <table class="data-table">
        <thead>
          <tr>
            <th></th>
            <th>Producto</th>
            <th>Unid. x Tanda</th>
            <th>Costo Total</th>
            <th>Costo Unitario</th>
            <th>% Utilidad</th>
            <th>Precio + Utilidad</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
    `;

    productos.forEach(p => {
      const activo = p.activo !== 0;
      html += `
        <tr data-id="${p.id}" class="${activo ? '' : 'fila-inactiva'}">
          <td>
            <button type="button" class="btn-row-toggle btn-toggle-prod ${activo ? 'is-on' : 'is-off'}" title="${activo ? 'Activo — click para deshabilitar' : 'Deshabilitado — click para activar'}" data-id="${p.id}" data-activo="${activo ? 1 : 0}">
              ${activo ? ICON_CHECK : ICON_X}
            </button>
          </td>
          <td>${p.nombre}</td>
          <td>${Utils.formatNumber(p.unidades_por_tanda)}</td>
          <td class="cell--currency">${Utils.formatCurrency(p.costo_total)}</td>
          <td class="cell--currency">${Utils.formatCurrency(p.costo_unitario)}</td>
          <td>${p.utilidad_deseada_pct}%</td>
          <td class="cell--currency cell--precio">${Utils.formatCurrency(p.precio_con_utilidad)}</td>
          <td><button type="button" class="btn-row-delete btn-delete-prod" title="Eliminar" data-id="${p.id}" data-nombre="${p.nombre.replace(/"/g, '&quot;')}">${ICON_TRASH}</button></td>
        </tr>
      `;
    });

    html += '</tbody></table>';
    wrapper.innerHTML = html;

    wrapper.querySelectorAll('.data-table tbody tr').forEach(tr => {
      tr.addEventListener('click', (e) => {
        if (e.target.closest('.btn-delete-prod') || e.target.closest('.btn-toggle-prod')) return;
        location.href = `producto.html?id=${encodeURIComponent(tr.dataset.id)}`;
      });
    });
    wrapper.querySelectorAll('.btn-delete-prod').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        eliminarProducto(btn.dataset.id, btn.dataset.nombre);
      });
    });
    wrapper.querySelectorAll('.btn-toggle-prod').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleActivo(btn.dataset.id, btn.dataset.activo === '1');
      });
    });
  }

  async function toggleActivo(id, activoActual) {
    const nuevoValor = !activoActual;
    try {
      const res = await window.sweetAuth.fetch(`/api/recetas?id=${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: nuevoValor }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo actualizar.');
      const producto = todosLosProductos.find(p => p.id === id);
      if (producto) producto.activo = nuevoValor ? 1 : 0;
      renderTabla();
      Utils.toast(nuevoValor ? 'Producto habilitado' : 'Producto deshabilitado', 'success');
    } catch (err) {
      Utils.toast(err.message, 'error');
    }
  }

  async function eliminarProducto(id, nombre) {
    const confirmado = await Utils.confirm('¿Eliminar producto?', `Se va a eliminar "${nombre}" y toda su receta. Esta acción no se puede deshacer.`, 'Eliminar');
    if (!confirmado) return;
    try {
      const res = await window.sweetAuth.fetch(`/api/recetas?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo eliminar.');
      Utils.toast('Producto eliminado', 'success');
      await cargarProductos();
    } catch (err) {
      Utils.toast(err.message, 'error');
    }
  }

  async function crearProducto() {
    const input = document.getElementById('new-prod-nombre');
    const nombre = input.value.trim();
    if (!nombre) { Utils.toast('Escribí el nombre del producto', 'error'); return; }

    try {
      const res = await window.sweetAuth.fetch('/api/recetas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo crear.');
      location.href = `producto.html?id=${encodeURIComponent(data.id)}`;
    } catch (err) {
      Utils.toast(err.message, 'error');
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    window.sweetAuth.onReady(function () {
      document.getElementById('btn-add-prod').addEventListener('click', crearProducto);
      document.getElementById('new-prod-nombre').addEventListener('keydown', e => { if (e.key === 'Enter') crearProducto(); });
      document.getElementById('filter-deshabilitados').addEventListener('change', renderTabla);
      cargarProductos();
    });
  });
})();
