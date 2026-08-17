// ============================================
// CAJA CHICA — Gestión de ítems y clasificaciones (dueño/supervisor)
// ============================================

(function () {
  'use strict';

  let items = [];
  let clasificaciones = [];

  const ICON_PENCIL = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path></svg>';
  const ICON_TRASH = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
  const ICON_CHECK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
  const ICON_X = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';

  async function loadAll() {
    try {
      const catalogo = await Storage.cargarCatalogo();
      items = catalogo.items;
      clasificaciones = catalogo.clasificaciones;
    } catch (err) {
      Utils.toast('No se pudo cargar el catálogo: ' + err.message, 'error');
      return;
    }
    renderClasificaciones();
    renderItemClasifSelect();
    renderItemsList();
  }

  // ============================================
  // CLASIFICACIONES
  // ============================================

  function renderClasificaciones() {
    const container = document.getElementById('clasif-list');
    container.innerHTML = clasificaciones.map(c => {
      const count = items.filter(i => i.clasificacion === c).length;
      return `
        <span class="clasif-chip" data-nombre="${c.replace(/"/g, '&quot;')}">
          <span class="clasif-chip__label">${c}</span>
          <span class="clasif-chip__count">(${count})</span>
          <button type="button" class="btn-rename-clasif" title="Renombrar">${ICON_PENCIL}</button>
          <button type="button" class="btn-delete-clasif danger" title="Eliminar">${ICON_TRASH}</button>
        </span>
      `;
    }).join('');

    container.querySelectorAll('.btn-rename-clasif').forEach(btn => {
      btn.addEventListener('click', () => startRenameClasif(btn.closest('.clasif-chip')));
    });
    container.querySelectorAll('.btn-delete-clasif').forEach(btn => {
      btn.addEventListener('click', () => deleteClasif(btn.closest('.clasif-chip').dataset.nombre));
    });
  }

  function startRenameClasif(chip) {
    const nombreViejo = chip.dataset.nombre;
    chip.innerHTML = `
      <input type="text" value="${nombreViejo.replace(/"/g, '&quot;')}">
      <button type="button" class="btn-save-clasif" title="Guardar">${ICON_CHECK}</button>
      <button type="button" class="btn-cancel-clasif" title="Cancelar">${ICON_X}</button>
    `;
    const input = chip.querySelector('input');
    input.focus();
    input.select();

    const save = async () => {
      const nuevo = input.value.trim().toUpperCase();
      if (!nuevo || nuevo === nombreViejo) { renderClasificaciones(); return; }
      try {
        await Storage.renombrarClasificacion(nombreViejo, nuevo);
        Utils.toast('Clasificación renombrada', 'success');
        await loadAll();
      } catch (err) {
        Utils.toast(err.message, 'error');
        renderClasificaciones();
      }
    };

    chip.querySelector('.btn-save-clasif').addEventListener('click', save);
    chip.querySelector('.btn-cancel-clasif').addEventListener('click', () => renderClasificaciones());
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') save();
      if (e.key === 'Escape') renderClasificaciones();
    });
  }

  async function deleteClasif(nombre) {
    const confirmed = await Utils.confirm('¿Eliminar clasificación?', `Se va a eliminar "${nombre}". Solo se puede si ningún ítem la usa.`, 'Eliminar');
    if (!confirmed) return;
    try {
      await Storage.eliminarClasificacion(nombre);
      Utils.toast('Clasificación eliminada', 'success');
      await loadAll();
    } catch (err) {
      Utils.toast(err.message, 'error');
    }
  }

  document.getElementById('btn-add-clasif').addEventListener('click', async () => {
    const input = document.getElementById('new-clasif-input');
    const nombre = input.value.trim();
    if (!nombre) { Utils.toast('Escribí un nombre para la clasificación', 'error'); return; }
    try {
      await Storage.crearClasificacion(nombre);
      input.value = '';
      Utils.toast('Clasificación creada', 'success');
      await loadAll();
    } catch (err) {
      Utils.toast(err.message, 'error');
    }
  });

  // ============================================
  // ÍTEMS
  // ============================================

  function renderItemClasifSelect() {
    const select = document.getElementById('new-item-clasif');
    select.innerHTML = clasificaciones.map(c => `<option value="${c.replace(/"/g, '&quot;')}">${c}</option>`).join('');
  }

  function renderItemsList() {
    const container = document.getElementById('items-list');
    document.getElementById('items-count').textContent = `Ítems (${items.length})`;

    if (items.length === 0) {
      container.innerHTML = '<p class="empty-note" style="color:var(--text-muted);padding:24px 0;text-align:center;">Todavía no hay ítems cargados.</p>';
      return;
    }

    let html = '';
    clasificaciones.forEach(clasif => {
      const grupo = items.filter(i => i.clasificacion === clasif);
      if (grupo.length === 0) return;
      html += `<div class="item-group__title">${clasif} (${grupo.length})</div>`;
      grupo.forEach(i => {
        html += `
          <div class="item-row" data-id="${i.id}">
            <span class="item-row__name">${i.item}</span>
            <span class="item-row__actions">
              <button type="button" class="btn-edit-item" title="Editar">${ICON_PENCIL}</button>
              <button type="button" class="btn-delete-item danger" title="Eliminar">${ICON_TRASH}</button>
            </span>
          </div>
        `;
      });
    });
    container.innerHTML = html;

    container.querySelectorAll('.btn-edit-item').forEach(btn => {
      btn.addEventListener('click', () => startEditItem(btn.closest('.item-row')));
    });
    container.querySelectorAll('.btn-delete-item').forEach(btn => {
      btn.addEventListener('click', () => deleteItem(btn.closest('.item-row').dataset.id));
    });
  }

  function startEditItem(row) {
    const id = row.dataset.id;
    const item = items.find(i => i.id === id);
    if (!item) return;

    const options = clasificaciones.map(c => `<option value="${c.replace(/"/g, '&quot;')}" ${c === item.clasificacion ? 'selected' : ''}>${c}</option>`).join('');
    row.innerHTML = `
      <span style="display:flex;gap:8px;flex:1;">
        <input type="text" value="${item.item.replace(/"/g, '&quot;')}" style="flex:1;background:var(--bg-input);border:1px solid var(--border-color, rgba(255,255,255,0.1));border-radius:6px;padding:6px 10px;color:var(--text-primary);font-size:var(--font-size-sm);">
        <select style="background:var(--bg-input);border:1px solid var(--border-color, rgba(255,255,255,0.1));border-radius:6px;padding:6px 10px;color:var(--text-primary);font-size:var(--font-size-sm);">${options}</select>
      </span>
      <span class="item-row__actions">
        <button type="button" class="btn-save-item" title="Guardar">${ICON_CHECK}</button>
        <button type="button" class="btn-cancel-item" title="Cancelar">${ICON_X}</button>
      </span>
    `;

    const nameInput = row.querySelector('input');
    const clasifSelect = row.querySelector('select');
    nameInput.focus();
    nameInput.select();

    const save = async () => {
      const nuevoNombre = nameInput.value.trim();
      const nuevaClasif = clasifSelect.value;
      if (!nuevoNombre) { Utils.toast('El nombre no puede quedar vacío', 'error'); return; }
      try {
        await Storage.editarItem(id, { item: nuevoNombre, clasificacion: nuevaClasif });
        Utils.toast('Ítem actualizado', 'success');
        await loadAll();
      } catch (err) {
        Utils.toast(err.message, 'error');
        renderItemsList();
      }
    };

    row.querySelector('.btn-save-item').addEventListener('click', save);
    row.querySelector('.btn-cancel-item').addEventListener('click', () => renderItemsList());
    nameInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') save();
      if (e.key === 'Escape') renderItemsList();
    });
  }

  async function deleteItem(id) {
    const item = items.find(i => i.id === id);
    const confirmed = await Utils.confirm('¿Eliminar ítem?', `Se va a eliminar "${item ? item.item : ''}" del catálogo. Los movimientos ya cargados con este ítem no se ven afectados.`, 'Eliminar');
    if (!confirmed) return;
    try {
      await Storage.eliminarItem(id);
      Utils.toast('Ítem eliminado', 'success');
      await loadAll();
    } catch (err) {
      Utils.toast(err.message, 'error');
    }
  }

  document.getElementById('btn-add-item').addEventListener('click', async () => {
    const nombreInput = document.getElementById('new-item-nombre');
    const clasifSelect = document.getElementById('new-item-clasif');
    const nombre = nombreInput.value.trim();
    const clasif = clasifSelect.value;
    if (!nombre) { Utils.toast('Escribí el nombre del ítem', 'error'); return; }
    if (!clasif) { Utils.toast('Elegí una clasificación (o creá una primero)', 'error'); return; }
    try {
      await Storage.crearItem(nombre, clasif);
      nombreInput.value = '';
      Utils.toast('Ítem agregado', 'success');
      await loadAll();
    } catch (err) {
      Utils.toast(err.message, 'error');
    }
  });

  document.addEventListener('DOMContentLoaded', function () {
    window.sweetAuth.onReady(function () {
      loadAll();
    });
  });
})();
