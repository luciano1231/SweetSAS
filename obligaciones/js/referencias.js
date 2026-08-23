// ============================================
// OBLIGACIONES — Gestión de Referencias (Banco + Clasificación General)
// ============================================

(function () {
  'use strict';

  const ICON_PENCIL = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path></svg>';
  const ICON_TRASH  = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
  const ICON_CHECK  = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
  const ICON_X      = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';

  const CONFIGS = {
    banco: { campos: ['dato_buscar', 'obligacion'], contenedor: 'referencias-banco-list' },
    general: { campos: ['obligacion', 'clasificacion'], contenedor: 'referencias-generales-list' },
  };

  const datos = { banco: [], general: [] };

  async function cargar(tipo) {
    const res = await fetch(`/api/obligaciones-referencias?tipo=${tipo}`);
    const data = await res.json();
    if (!res.ok || !data.ok) {
      Utils.toast('No se pudo cargar: ' + (data.error || tipo), 'error');
      return;
    }
    datos[tipo] = data.referencias;
    render(tipo);
  }

  function render(tipo) {
    const { campos, contenedor } = CONFIGS[tipo];
    const el = document.getElementById(contenedor);

    if (datos[tipo].length === 0) {
      el.innerHTML = '<p style="color:var(--text-muted);padding:16px 4px;">Todavía no hay registros.</p>';
      return;
    }

    el.innerHTML = datos[tipo].map(r => `
      <div class="ref-row" data-id="${r.id}">
        <span>${r[campos[0]] || ''}</span>
        <span>${r[campos[1]] || '<em style="color:var(--text-muted);">sin definir</em>'}</span>
        <span class="ref-row__actions">
          <button type="button" class="btn-edit" title="Editar">${ICON_PENCIL}</button>
          <button type="button" class="btn-delete danger" title="Eliminar">${ICON_TRASH}</button>
        </span>
      </div>
    `).join('');

    el.querySelectorAll('.btn-edit').forEach(btn => {
      btn.addEventListener('click', () => iniciarEdicion(tipo, btn.closest('.ref-row')));
    });
    el.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', () => eliminar(tipo, btn.closest('.ref-row').dataset.id));
    });
  }

  function iniciarEdicion(tipo, fila) {
    const { campos } = CONFIGS[tipo];
    const id = fila.dataset.id;
    const registro = datos[tipo].find(r => r.id === id);

    fila.innerHTML = `
      <input type="text" value="${(registro[campos[0]] || '').replace(/"/g, '&quot;')}" data-campo="${campos[0]}">
      <input type="text" value="${(registro[campos[1]] || '').replace(/"/g, '&quot;')}" data-campo="${campos[1]}">
      <span class="ref-row__actions">
        <button type="button" class="btn-save" title="Guardar">${ICON_CHECK}</button>
        <button type="button" class="btn-cancel" title="Cancelar">${ICON_X}</button>
      </span>
    `;
    const inputs = fila.querySelectorAll('input');
    inputs[0].focus();

    const guardar = () => guardarEdicion(tipo, id, {
      [campos[0]]: inputs[0].value.trim(),
      [campos[1]]: inputs[1].value.trim(),
    });

    fila.querySelector('.btn-save').addEventListener('click', guardar);
    fila.querySelector('.btn-cancel').addEventListener('click', () => render(tipo));
    inputs.forEach(inp => inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') guardar();
      if (e.key === 'Escape') render(tipo);
    }));
  }

  async function guardarEdicion(tipo, id, cambios) {
    try {
      const res = await fetch(`/api/obligaciones-referencias?tipo=${tipo}&id=${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cambios),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo guardar.');
      Utils.toast('Guardado', 'success');
      await cargar(tipo);
    } catch (err) {
      Utils.toast(err.message, 'error');
    }
  }

  async function eliminar(tipo, id) {
    const confirmado = await Utils.confirm('¿Eliminar?', 'Esta acción no se puede deshacer.', 'Eliminar');
    if (!confirmado) return;
    try {
      const res = await fetch(`/api/obligaciones-referencias?tipo=${tipo}&id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo eliminar.');
      Utils.toast('Eliminado', 'success');
      await cargar(tipo);
    } catch (err) {
      Utils.toast(err.message, 'error');
    }
  }

  async function crear(tipo) {
    const { campos } = CONFIGS[tipo];

    // IDs en el HTML: new-banco-dato / new-banco-obligacion / new-general-obligacion / new-general-clasificacion
    const idCampo0 = tipo === 'banco' ? 'new-banco-dato' : 'new-general-obligacion';
    const idCampo1 = tipo === 'banco' ? 'new-banco-obligacion' : 'new-general-clasificacion';
    const el0 = document.getElementById(idCampo0);
    const el1 = document.getElementById(idCampo1);

    const valor0 = el0.value.trim();
    const valor1 = el1.value.trim();

    if (!valor0) { Utils.toast(`Completá el primer campo`, 'error'); return; }

    try {
      const res = await fetch(`/api/obligaciones-referencias?tipo=${tipo}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [campos[0]]: valor0, [campos[1]]: valor1 }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo crear.');
      el0.value = '';
      el1.value = '';
      Utils.toast('Agregado', 'success');
      await cargar(tipo);
    } catch (err) {
      Utils.toast(err.message, 'error');
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    window.sweetAuth.onReady(function () {
      document.getElementById('btn-add-banco').addEventListener('click', () => crear('banco'));
      document.getElementById('btn-add-general').addEventListener('click', () => crear('general'));
      cargar('banco');
      cargar('general');
    });
  });
})();
