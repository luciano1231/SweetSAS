// ============================================
// RECETAS — Editor de un producto (ingredientes + costos fijos + precio)
// ============================================

(function () {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  const productoId = params.get('id');

  if (!productoId) {
    window.location.href = 'index.html';
    return;
  }

  const ICON_TRASH = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';

  let catalogoIngredientes = [];
  let catalogoCostosFijos = [];
  let seleccionIng = null;
  let seleccionCf = null;

  // ============================================
  // CARGA Y RENDER
  // ============================================

  async function cargarDetalle() {
    const res = await window.sweetAuth.fetch(`/api/recetas?id=${encodeURIComponent(productoId)}`);
    const data = await res.json();
    if (!res.ok || !data.ok) {
      Utils.toast(data.error || 'No se pudo cargar el producto.', 'error');
      return null;
    }
    return data;
  }

  function renderResumen(data) {
    const p = data.producto;
    document.getElementById('header-nombre').textContent = p.nombre;
    document.title = `${p.nombre} — Recetas`;
    document.getElementById('input-unidades').value = p.unidades_por_tanda;
    document.getElementById('input-utilidad').value = p.utilidad_deseada_pct;
    document.getElementById('input-observaciones').value = p.observaciones || '';
    document.getElementById('input-receta').value = p.receta_texto || '';

    document.getElementById('val-costo-ing').textContent = Utils.formatCurrency(data.totalIngredientes);
    document.getElementById('val-costo-fijos').textContent = Utils.formatCurrency(data.totalCostosFijos);
    document.getElementById('val-costo-total').textContent = Utils.formatCurrency(data.costo_total);
    document.getElementById('val-costo-unitario').textContent = Utils.formatCurrency(data.costo_unitario);
    document.getElementById('val-precio').textContent = Utils.formatCurrency(data.precio_con_utilidad);
  }

  function renderTablaLineas(contenedorId, lineas, tipo) {
    const el = document.getElementById(contenedorId);
    if (lineas.length === 0) {
      el.innerHTML = '<div class="empty-state"><p class="empty-state__text">Todavía no se agregó ninguno.</p></div>';
      return;
    }

    const totalSubtotal = lineas.reduce((s, l) => s + l.subtotal, 0);

    let html = `
      <table class="data-table">
        <thead>
          <tr>
            <th>${tipo === 'ingrediente' ? 'Ingrediente' : 'Costo Fijo'}</th>
            <th>Costo x Unidad</th>
            <th>Cantidad</th>
            <th>Subtotal</th>
            <th>% Costo</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
    `;
    lineas.forEach(l => {
      html += `
        <tr data-linea-id="${l.id}">
          <td>${l.nombre}</td>
          <td class="cell--currency">${Utils.formatCurrency(l.costo_fraccion)}</td>
          <td><input type="number" class="obl-inline-input linea-cantidad" style="max-width:100px;" min="0" step="0.01" value="${l.cantidad}"></td>
          <td class="cell--currency">${Utils.formatCurrency(l.subtotal)}</td>
          <td class="cell--porcentaje">${l.porcentaje}%</td>
          <td><button type="button" class="btn-row-delete btn-delete-linea" title="Quitar">${ICON_TRASH}</button></td>
        </tr>
      `;
    });
    html += `
        <tr class="fila-total">
          <td colspan="3">TOTAL</td>
          <td class="cell--currency">${Utils.formatCurrency(totalSubtotal)}</td>
          <td colspan="2"></td>
        </tr>
      </tbody></table>
    `;
    el.innerHTML = html;

    el.querySelectorAll('.linea-cantidad').forEach(input => {
      input.addEventListener('change', () => editarCantidad(tipo, input.closest('tr').dataset.lineaId, input));
    });
    el.querySelectorAll('.btn-delete-linea').forEach(btn => {
      btn.addEventListener('click', () => eliminarLinea(tipo, btn.closest('tr').dataset.lineaId));
    });
  }

  async function recargarTodo() {
    const data = await cargarDetalle();
    if (!data) return;
    renderResumen(data);
    renderTablaLineas('ingredientes-table', data.ingredientes, 'ingrediente');
    renderTablaLineas('costosfijos-table', data.costosFijos, 'costofijo');
  }

  // ============================================
  // EDICIÓN DE CAMPOS DEL RESUMEN
  // ============================================

  async function guardarCampoProducto(campo, valor) {
    try {
      const res = await window.sweetAuth.fetch(`/api/recetas?id=${encodeURIComponent(productoId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [campo]: valor }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo guardar.');
      await recargarTodo();
    } catch (err) {
      Utils.toast('Error: ' + err.message, 'error');
    }
  }

  // ============================================
  // LÍNEAS: agregar / editar / eliminar
  // ============================================

  async function agregarLinea(tipo) {
    const seleccion = tipo === 'ingrediente' ? seleccionIng : seleccionCf;
    const cantidadInput = document.getElementById(tipo === 'ingrediente' ? 'ing-cantidad' : 'cf-cantidad');
    const cantidad = Number(cantidadInput.value);

    if (!seleccion) { Utils.toast('Elegí un ítem de la lista', 'error'); return; }
    if (!(cantidad > 0)) { Utils.toast('La cantidad tiene que ser mayor a 0', 'error'); return; }

    const campoRef = tipo === 'ingrediente' ? 'ingrediente_id' : 'costo_fijo_id';
    try {
      const res = await window.sweetAuth.fetch(`/api/recetas-items?tipo=${tipo}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ producto_id: productoId, [campoRef]: seleccion.id, cantidad }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo agregar.');

      cantidadInput.value = '';
      if (tipo === 'ingrediente') {
        document.getElementById('ing-search').value = '';
        document.getElementById('ing-value').value = '';
        seleccionIng = null;
      } else {
        document.getElementById('cf-search').value = '';
        document.getElementById('cf-value').value = '';
        seleccionCf = null;
      }
      Utils.toast('✓ Agregado', 'success');
      await recargarTodo();
    } catch (err) {
      Utils.toast(err.message, 'error');
    }
  }

  async function editarCantidad(tipo, leaId, input) {
    const cantidad = Number(input.value);
    if (!(cantidad > 0)) { Utils.toast('La cantidad tiene que ser mayor a 0', 'error'); await recargarTodo(); return; }
    try {
      const res = await window.sweetAuth.fetch(`/api/recetas-items?tipo=${tipo}&id=${encodeURIComponent(leaId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cantidad }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo actualizar.');
      await recargarTodo();
    } catch (err) {
      Utils.toast(err.message, 'error');
    }
  }

  async function eliminarLinea(tipo, leaId) {
    try {
      const res = await window.sweetAuth.fetch(`/api/recetas-items?tipo=${tipo}&id=${encodeURIComponent(leaId)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo quitar.');
      await recargarTodo();
    } catch (err) {
      Utils.toast(err.message, 'error');
    }
  }

  // ============================================
  // BUSCADOR (combobox) — igual patrón que Caja Chica
  // ============================================

  function setupCombobox(prefijo, catalogoGetter, onPick) {
    const input = document.getElementById(`${prefijo}-search`);
    const list = document.getElementById(`${prefijo}-list`);
    let activeIndex = -1;

    function normalize(s) {
      return (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    }

    function filtered(query) {
      const catalogo = catalogoGetter();
      const q = normalize(query);
      if (!q) return catalogo;
      return catalogo.filter(i => normalize(i.nombre).includes(q));
    }

    function renderList(query) {
      const items = filtered(query);
      activeIndex = -1;

      if (items.length === 0) {
        list.innerHTML = '<div class="combobox__empty">Sin resultados</div>';
        list.hidden = false;
        return;
      }

      list.innerHTML = items.map(i =>
        `<div class="combobox__option" data-id="${i.id}">${i.nombre} <span style="color:var(--text-muted);float:right;">${Utils.formatCurrency(i.costo_fraccion)}</span></div>`
      ).join('');
      list.hidden = false;

      list.querySelectorAll('.combobox__option').forEach(opt => {
        opt.addEventListener('mousedown', (e) => {
          e.preventDefault();
          const item = catalogoGetter().find(i => i.id === opt.dataset.id);
          pick(item);
        });
      });
    }

    function pick(item) {
      input.value = item.nombre;
      document.getElementById(`${prefijo}-value`).value = item.id;
      onPick(item);
      list.hidden = true;
    }

    function setActive(idx) {
      const opts = list.querySelectorAll('.combobox__option');
      opts.forEach(o => o.classList.remove('is-active'));
      if (idx >= 0 && idx < opts.length) {
        opts[idx].classList.add('is-active');
        opts[idx].scrollIntoView({ block: 'nearest' });
      }
      activeIndex = idx;
    }

    input.addEventListener('input', () => {
      onPick(null);
      document.getElementById(`${prefijo}-value`).value = '';
      renderList(input.value);
    });
    input.addEventListener('focus', () => renderList(input.value));
    input.addEventListener('keydown', (e) => {
      const opts = () => list.querySelectorAll('.combobox__option');
      if (e.key === 'ArrowDown') { e.preventDefault(); if (list.hidden) { renderList(input.value); return; } setActive(Math.min(activeIndex + 1, opts().length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(activeIndex - 1, 0)); }
      else if (e.key === 'Enter') {
        if (!list.hidden && activeIndex >= 0) {
          e.preventDefault();
          const opt = opts()[activeIndex];
          if (opt) pick(catalogoGetter().find(i => i.id === opt.dataset.id));
        }
      } else if (e.key === 'Escape') { list.hidden = true; }
    });
    document.addEventListener('click', (e) => {
      if (!document.getElementById(`${prefijo}-combobox`).contains(e.target)) list.hidden = true;
    });
  }

  async function cargarCatalogos() {
    try {
      const [resIng, resCf] = await Promise.all([
        window.sweetAuth.fetch('/api/recetas-catalogo?tipo=ingrediente'),
        window.sweetAuth.fetch('/api/recetas-catalogo?tipo=costofijo'),
      ]);
      const dataIng = await resIng.json();
      const dataCf = await resCf.json();
      if (dataIng.ok) catalogoIngredientes = dataIng.items;
      if (dataCf.ok) catalogoCostosFijos = dataCf.items;
    } catch (e) {
      Utils.toast('No se pudo cargar el catálogo de ingredientes/costos fijos.', 'error');
    }
  }

  // ============================================
  // INIT
  // ============================================

  document.addEventListener('DOMContentLoaded', function () {
    window.sweetAuth.onReady(async function () {
      await cargarCatalogos();

      setupCombobox('ing', () => catalogoIngredientes, (item) => { seleccionIng = item; });
      setupCombobox('cf', () => catalogoCostosFijos, (item) => { seleccionCf = item; });

      document.getElementById('btn-add-ing-linea').addEventListener('click', () => agregarLinea('ingrediente'));
      document.getElementById('btn-add-cf-linea').addEventListener('click', () => agregarLinea('costofijo'));

      document.getElementById('input-unidades').addEventListener('change', (e) => guardarCampoProducto('unidades_por_tanda', e.target.value));
      document.getElementById('input-utilidad').addEventListener('change', (e) => guardarCampoProducto('utilidad_deseada_pct', e.target.value));
      document.getElementById('input-observaciones').addEventListener('change', (e) => guardarCampoProducto('observaciones', e.target.value));
      document.getElementById('input-receta').addEventListener('change', (e) => guardarCampoProducto('receta_texto', e.target.value));

      await recargarTodo();
    });
  });
})();
