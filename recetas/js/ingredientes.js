// ============================================
// RECETAS — Catálogo de Ingredientes y Costos Fijos
// ============================================

(function () {
  'use strict';

  const ICON_PENCIL = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path></svg>';
  const ICON_TRASH  = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
  const ICON_CHECK  = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
  const ICON_X      = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';

  const datos = { ingrediente: [], costofijo: [] };
  const CONTENEDOR = { ingrediente: 'ingredientes-list', costofijo: 'costosfijos-list' };

  async function cargar(tipo) {
    const res = await window.sweetAuth.fetch(`/api/recetas-catalogo?tipo=${tipo}`);
    const data = await res.json();
    if (!res.ok || !data.ok) {
      Utils.toast('No se pudo cargar: ' + (data.error || tipo), 'error');
      return;
    }
    datos[tipo] = data.items;
    render(tipo);
  }

  function render(tipo) {
    const el = document.getElementById(CONTENEDOR[tipo]);

    if (datos[tipo].length === 0) {
      el.innerHTML = '<p style="color:var(--text-muted);padding:16px 4px;">Todavía no hay registros.</p>';
      return;
    }

    el.innerHTML = datos[tipo].map(i => `
      <div class="ing-row" data-id="${i.id}">
        <span class="ing-row__valor">${i.nombre}</span>
        <span class="ing-row__valor">${Utils.formatCurrency(i.costo_bulto)}</span>
        <span class="ing-row__valor">${Utils.formatNumber(i.cantidad_bulto)}</span>
        <span class="ing-row__fraccion">${Utils.formatCurrency(i.costo_fraccion)}</span>
        <span class="ing-row__valor" style="color:var(--text-muted);font-size:.82rem;" title="${(i.observaciones || '').replace(/"/g, '&quot;')}">${i.observaciones || ''}</span>
        <span class="ing-row__actions">
          <button type="button" class="btn-edit" title="Editar">${ICON_PENCIL}</button>
          <button type="button" class="btn-delete danger" title="Eliminar">${ICON_TRASH}</button>
        </span>
      </div>
    `).join('');

    el.querySelectorAll('.btn-edit').forEach(btn => {
      btn.addEventListener('click', () => iniciarEdicion(tipo, btn.closest('.ing-row')));
    });
    el.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', () => eliminar(tipo, btn.closest('.ing-row').dataset.id));
    });
  }

  function iniciarEdicion(tipo, fila) {
    const id = fila.dataset.id;
    const item = datos[tipo].find(i => i.id === id);

    fila.innerHTML = `
      <input type="text" value="${item.nombre.replace(/"/g, '&quot;')}" data-campo="nombre">
      <input type="number" value="${item.costo_bulto}" step="0.01" min="0" data-campo="costo_bulto">
      <input type="number" value="${item.cantidad_bulto}" step="0.01" min="0" data-campo="cantidad_bulto">
      <span class="ing-row__fraccion" id="fraccion-preview">${Utils.formatCurrency(item.costo_fraccion)}</span>
      <input type="text" value="${(item.observaciones || '').replace(/"/g, '&quot;')}" data-campo="observaciones">
      <span class="ing-row__actions">
        <button type="button" class="btn-save" title="Guardar">${ICON_CHECK}</button>
        <button type="button" class="btn-cancel" title="Cancelar">${ICON_X}</button>
      </span>
    `;

    const inputCosto = fila.querySelector('[data-campo="costo_bulto"]');
    const inputCantidad = fila.querySelector('[data-campo="cantidad_bulto"]');
    const preview = fila.querySelector('#fraccion-preview');
    const actualizarPreview = () => {
      const c = Number(inputCosto.value) || 0;
      const q = Number(inputCantidad.value) || 0;
      preview.textContent = Utils.formatCurrency(q > 0 ? c / q : 0);
    };
    inputCosto.addEventListener('input', actualizarPreview);
    inputCantidad.addEventListener('input', actualizarPreview);

    fila.querySelector('[data-campo="nombre"]').focus();

    const guardar = () => guardarEdicion(tipo, id, {
      nombre: fila.querySelector('[data-campo="nombre"]').value.trim(),
      costo_bulto: fila.querySelector('[data-campo="costo_bulto"]').value,
      cantidad_bulto: fila.querySelector('[data-campo="cantidad_bulto"]').value,
      observaciones: fila.querySelector('[data-campo="observaciones"]').value.trim(),
    });

    fila.querySelector('.btn-save').addEventListener('click', guardar);
    fila.querySelector('.btn-cancel').addEventListener('click', () => render(tipo));
  }

  async function guardarEdicion(tipo, id, cambios) {
    try {
      const res = await window.sweetAuth.fetch(`/api/recetas-catalogo?tipo=${tipo}&id=${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cambios),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo guardar.');
      Utils.toast('✓ Costo actualizado', 'success');
      await cargar(tipo);
    } catch (err) {
      Utils.toast(err.message, 'error');
    }
  }

  async function eliminar(tipo, id) {
    const confirmado = await Utils.confirm('¿Eliminar?', 'Esta acción no se puede deshacer.', 'Eliminar');
    if (!confirmado) return;
    try {
      const res = await window.sweetAuth.fetch(`/api/recetas-catalogo?tipo=${tipo}&id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo eliminar.');
      Utils.toast('Eliminado', 'success');
      await cargar(tipo);
    } catch (err) {
      Utils.toast(err.message, 'error');
    }
  }

  async function crear(tipo) {
    const prefijo = tipo === 'ingrediente' ? 'new-ing-' : 'new-cf-';
    const elNombre = document.getElementById(`${prefijo}nombre`);
    const elCosto = document.getElementById(`${prefijo}costo`);
    const elCantidad = document.getElementById(`${prefijo}cantidad`);
    const elObs = document.getElementById(`${prefijo}obs`);

    const nombre = elNombre.value.trim();
    if (!nombre) { Utils.toast('Escribí un nombre', 'error'); return; }

    try {
      const res = await window.sweetAuth.fetch(`/api/recetas-catalogo?tipo=${tipo}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre,
          costo_bulto: elCosto.value,
          cantidad_bulto: elCantidad.value,
          observaciones: elObs.value.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo crear.');
      elNombre.value = ''; elCosto.value = ''; elCantidad.value = ''; elObs.value = '';
      Utils.toast('Agregado', 'success');
      await cargar(tipo);
    } catch (err) {
      Utils.toast(err.message, 'error');
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    window.sweetAuth.onReady(function () {
      document.getElementById('btn-add-ing').addEventListener('click', () => crear('ingrediente'));
      document.getElementById('btn-add-cf').addEventListener('click', () => crear('costofijo'));
      cargar('ingrediente');
      cargar('costofijo');
    });
  });
})();
