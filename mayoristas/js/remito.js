// ============================================
// MAYORISTAS — Remito abierto de un cliente
// ============================================

(function () {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  const clienteId = params.get('cliente');
  if (!clienteId) { window.location.href = 'index.html'; return; }

  const ICON_TRASH = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';

  let catalogo = [];
  let seleccion = null;

  async function cargarDetalle() {
    const res = await window.sweetAuth.fetch(`/api/mayoristas-remito?cliente_id=${encodeURIComponent(clienteId)}`);
    const data = await res.json();
    if (!res.ok || !data.ok) {
      Utils.toast(data.error || 'No se pudo cargar el remito.', 'error');
      return null;
    }
    return data;
  }

  function fechaLegible(iso) {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('es-AR');
  }

  function render(data) {
    catalogo = data.catalogo;

    document.getElementById('header-nombre').textContent = data.cliente.nombre;
    document.title = `Remito ${data.cliente.nombre} — Mayoristas`;

    const ultimo = data.ultimo_remito;
    document.getElementById('ultimo-remito-info').textContent = ultimo
      ? `Último remito rendido: N° ${String(ultimo.remito_numero).padStart(5, '0')} el día ${fechaLegible(ultimo.fecha)}`
      : 'Todavía no se cerró ningún remito para este cliente.';

    document.getElementById('val-total').textContent = Utils.formatCurrency(data.total);

    renderLineas(data.lineas);
  }

  function renderLineas(lineas) {
    const wrapper = document.getElementById('lineas-table');

    if (lineas.length === 0) {
      wrapper.innerHTML = '<div class="empty-state"><p class="empty-state__text">Todavía no se agregó ningún producto a este remito.</p></div>';
      return;
    }

    let html = `
      <table class="data-table data-table--stack">
        <thead>
          <tr>
            <th>Producto</th>
            <th>Precio unitario</th>
            <th>Cantidad</th>
            <th>Subtotal</th>
            <th>Enviado</th>
            <th>Recibido</th>
            <th>Pagado</th>
            <th>Observaciones</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
    `;
    lineas.forEach(l => {
      html += `
        <tr data-id="${l.id}">
          <td class="cell--title">${l.nombre_producto}</td>
          <td data-label="Precio unitario"><input type="number" class="obl-inline-input obl-inline-input--sm campo-precio" min="0" step="0.01" value="${l.precio_unitario}"></td>
          <td data-label="Cantidad"><input type="number" class="obl-inline-input obl-inline-input--sm campo-cantidad" min="0" step="0.01" value="${l.cantidad}"></td>
          <td class="cell--currency" data-label="Subtotal">${Utils.formatCurrency(l.subtotal)}</td>
          <td class="check-cell" data-label="Enviado"><input type="checkbox" class="campo-check" data-campo="enviado" ${l.enviado ? 'checked' : ''}></td>
          <td class="check-cell" data-label="Recibido"><input type="checkbox" class="campo-check" data-campo="recibido" ${l.recibido ? 'checked' : ''}></td>
          <td class="check-cell" data-label="Pagado"><input type="checkbox" class="campo-check" data-campo="pagado" ${l.pagado ? 'checked' : ''}></td>
          <td data-label="Observaciones"><input type="text" class="obl-inline-input campo-obs" value="${(l.observaciones || '').replace(/"/g, '&quot;')}" placeholder="—"></td>
          <td><button type="button" class="btn-row-delete btn-delete-linea" title="Quitar">${ICON_TRASH}</button></td>
        </tr>
      `;
    });
    html += '</tbody></table>';
    wrapper.innerHTML = html;

    wrapper.querySelectorAll('.campo-precio, .campo-cantidad').forEach(input => {
      input.addEventListener('change', () => editarLinea(input.closest('tr').dataset.id, {
        precio_unitario: input.closest('tr').querySelector('.campo-precio').value,
        cantidad: input.closest('tr').querySelector('.campo-cantidad').value,
      }));
    });
    wrapper.querySelectorAll('.campo-check').forEach(input => {
      input.addEventListener('change', () => editarLinea(input.closest('tr').dataset.id, { [input.dataset.campo]: input.checked }));
    });
    wrapper.querySelectorAll('.campo-obs').forEach(input => {
      input.addEventListener('change', () => editarLinea(input.closest('tr').dataset.id, { observaciones: input.value }));
    });
    wrapper.querySelectorAll('.btn-delete-linea').forEach(btn => {
      btn.addEventListener('click', () => eliminarLinea(btn.closest('tr').dataset.id));
    });
  }

  async function recargarTodo() {
    const data = await cargarDetalle();
    if (data) render(data);
  }

  async function editarLinea(id, cambios) {
    try {
      const res = await window.sweetAuth.fetch(`/api/mayoristas-remito?id=${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cambios),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo guardar.');
      await recargarTodo();
    } catch (err) {
      Utils.toast(err.message, 'error');
      await recargarTodo();
    }
  }

  async function eliminarLinea(id) {
    try {
      const res = await window.sweetAuth.fetch(`/api/mayoristas-remito?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo quitar.');
      await recargarTodo();
    } catch (err) {
      Utils.toast(err.message, 'error');
    }
  }

  async function agregarLinea() {
    const cantidad = Number(document.getElementById('linea-cantidad').value);
    const precioInput = document.getElementById('linea-precio').value;

    if (!seleccion) { Utils.toast('Elegí un producto de la lista', 'error'); return; }
    if (!(cantidad > 0)) { Utils.toast('La cantidad tiene que ser mayor a 0', 'error'); return; }

    try {
      const body = { producto_id: seleccion.id, cantidad };
      if (precioInput !== '') body.precio_unitario = Number(precioInput);

      const res = await window.sweetAuth.fetch(`/api/mayoristas-remito?cliente_id=${encodeURIComponent(clienteId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo agregar.');

      document.getElementById('prod-search').value = '';
      document.getElementById('prod-value').value = '';
      document.getElementById('linea-cantidad').value = '';
      document.getElementById('linea-precio').value = '';
      seleccion = null;
      Utils.toast('✓ Agregado', 'success');
      await recargarTodo();
    } catch (err) {
      Utils.toast(err.message, 'error');
    }
  }

  async function cerrarRemito() {
    const confirmado = await Utils.confirm(
      '¿Cerrar remito?',
      'Todas las líneas de este remito se van a guardar en el libro mayor con un número de remito nuevo, y esta lista queda vacía para el próximo pedido.',
      'Cerrar remito'
    );
    if (!confirmado) return;
    try {
      const res = await window.sweetAuth.fetch(`/api/mayoristas-remito?cliente_id=${encodeURIComponent(clienteId)}&accion=cerrar`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo cerrar el remito.');
      Utils.toast(`✓ Remito N° ${String(data.remito_numero).padStart(5, '0')} cerrado`, 'success');
      await recargarTodo();
    } catch (err) {
      Utils.toast(err.message, 'error');
    }
  }

  // ============================================
  // BUSCADOR (combobox) — mismo patrón que Recetas
  // ============================================
  function setupCombobox() {
    const input = document.getElementById('prod-search');
    const list = document.getElementById('prod-list');
    let activeIndex = -1;

    function normalize(s) {
      return (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    }

    function filtered(query) {
      const q = normalize(query);
      if (!q) return catalogo;
      return catalogo.filter(p => normalize(p.nombre).includes(q));
    }

    function renderList(query) {
      const items = filtered(query);
      activeIndex = -1;
      if (items.length === 0) {
        list.innerHTML = `<div class="combobox__empty">${catalogo.length === 0 ? 'Este cliente no tiene ninguna lista de productos asignada' : 'Sin resultados'}</div>`;
        list.hidden = false;
        return;
      }
      list.innerHTML = items.map(p =>
        `<div class="combobox__option" data-id="${p.id}">${p.nombre} <span style="color:var(--text-muted);float:right;">${Utils.formatCurrency(p.precio)}</span></div>`
      ).join('');
      list.hidden = false;
      list.querySelectorAll('.combobox__option').forEach(opt => {
        opt.addEventListener('mousedown', (e) => {
          e.preventDefault();
          pick(catalogo.find(p => p.id === opt.dataset.id));
        });
      });
    }

    function pick(item) {
      input.value = item.nombre;
      document.getElementById('prod-value').value = item.id;
      document.getElementById('linea-precio').value = item.precio;
      seleccion = item;
      list.hidden = true;
    }

    input.addEventListener('input', () => {
      seleccion = null;
      document.getElementById('prod-value').value = '';
      renderList(input.value);
    });
    input.addEventListener('focus', () => renderList(input.value));
    input.addEventListener('keydown', (e) => {
      const opts = () => list.querySelectorAll('.combobox__option');
      if (e.key === 'ArrowDown') { e.preventDefault(); if (list.hidden) { renderList(input.value); return; } setActive(Math.min(activeIndex + 1, opts().length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(activeIndex - 1, 0)); }
      else if (e.key === 'Enter') {
        if (!list.hidden && activeIndex >= 0) { e.preventDefault(); const opt = opts()[activeIndex]; if (opt) pick(catalogo.find(p => p.id === opt.dataset.id)); }
      } else if (e.key === 'Escape') { list.hidden = true; }
    });
    document.addEventListener('click', (e) => {
      if (!document.getElementById('prod-combobox').contains(e.target)) list.hidden = true;
    });

    function setActive(idx) {
      const opts = list.querySelectorAll('.combobox__option');
      opts.forEach(o => o.classList.remove('is-active'));
      if (idx >= 0 && idx < opts.length) { opts[idx].classList.add('is-active'); opts[idx].scrollIntoView({ block: 'nearest' }); }
      activeIndex = idx;
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    window.sweetAuth.onReady(async function () {
      setupCombobox();
      document.getElementById('btn-add-linea').addEventListener('click', agregarLinea);
      document.getElementById('btn-cerrar-remito').addEventListener('click', cerrarRemito);
      await recargarTodo();
    });
  });
})();
