// ============================================
// MAYORISTAS — Listas de Productos (reutilizables entre clientes)
// ============================================

(function () {
  'use strict';

  const ICON_TRASH = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
  const ICON_X = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
  const ICON_PENCIL = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path></svg>';
  const ICON_CHECK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';

  let listas = [];
  let catalogoProductos = [];

  async function cargarCatalogo() {
    const res = await window.sweetAuth.fetch('/api/recetas');
    const data = await res.json();
    if (res.ok && data.ok) catalogoProductos = data.productos.filter(p => p.activo !== 0);
  }

  async function cargarListas() {
    const cont = document.getElementById('listas-container');
    cont.innerHTML = '<div class="empty-state"><p class="empty-state__text">Cargando...</p></div>';
    try {
      const res = await window.sweetAuth.fetch('/api/mayoristas-listas');
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudieron cargar las listas.');
      listas = data.listas;
    } catch (err) {
      cont.innerHTML = `<div class="empty-state"><p class="empty-state__text">${err.message}</p></div>`;
      return;
    }
    render();
  }

  function render() {
    const cont = document.getElementById('listas-container');

    if (listas.length === 0) {
      cont.innerHTML = `
        <div class="card animate-in animate-in--delay-3">
          <div class="empty-state"><p class="empty-state__text">Todavía no hay ninguna lista. Creá la primera arriba.</p></div>
        </div>
      `;
      return;
    }

    cont.innerHTML = listas.map((l, idx) => `
      <div class="card animate-in animate-in--delay-${Math.min(idx + 3, 5)}" data-lista-id="${l.id}">
        <div class="lista-card__header">
          <div class="lista-card__nombre" data-rol="nombre">${l.nombre}</div>
          <div class="lista-card__acciones">
            <button type="button" class="btn-row-toggle is-on" data-rol="renombrar" title="Renombrar">${ICON_PENCIL}</button>
            <button type="button" class="btn-row-toggle is-off" data-rol="eliminar" title="Eliminar lista">${ICON_TRASH}</button>
          </div>
        </div>
        <div class="form-group combobox add-prod-row" data-rol="combobox">
          <input type="text" class="form-input" data-rol="search" placeholder="Buscar producto para agregar..." autocomplete="off">
          <div class="combobox__list" data-rol="list" hidden></div>
        </div>
        <div class="prod-chip-list" data-rol="chips">
          ${l.productos.length === 0
            ? '<span style="color:var(--text-muted);font-size:var(--font-size-sm);">Sin productos todavía.</span>'
            : l.productos.map(p => `
              <span class="prod-chip" data-producto-id="${p.producto_id}">
                ${p.nombre}
                <button type="button" data-rol="quitar-producto" title="Quitar">${ICON_X}</button>
              </span>
            `).join('')}
        </div>
      </div>
    `).join('');

    listas.forEach(l => wireCard(l));
  }

  function wireCard(lista) {
    const card = document.querySelector(`[data-lista-id="${lista.id}"]`);
    if (!card) return;

    card.querySelector('[data-rol="renombrar"]').addEventListener('click', () => iniciarRenombrar(lista, card));
    card.querySelector('[data-rol="eliminar"]').addEventListener('click', () => eliminarLista(lista));

    card.querySelectorAll('[data-rol="quitar-producto"]').forEach(btn => {
      btn.addEventListener('click', () => quitarProducto(lista, btn.closest('.prod-chip').dataset.productoId));
    });

    setupCombobox(card, lista);
  }

  function iniciarRenombrar(lista, card) {
    const el = card.querySelector('[data-rol="nombre"]');
    el.innerHTML = `<input type="text" class="form-input" value="${lista.nombre.replace(/"/g, '&quot;')}" style="max-width:280px;display:inline-block;">
      <button type="button" class="btn-row-toggle is-on" data-rol="guardar-nombre">${ICON_CHECK}</button>`;
    const input = el.querySelector('input');
    input.focus();
    input.select();

    const guardar = async () => {
      const nuevo = input.value.trim();
      if (!nuevo || nuevo === lista.nombre) { render(); return; }
      try {
        const res = await window.sweetAuth.fetch(`/api/mayoristas-listas?id=${encodeURIComponent(lista.id)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre: nuevo }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo renombrar.');
        await cargarListas();
      } catch (err) {
        Utils.toast(err.message, 'error');
        render();
      }
    };
    el.querySelector('[data-rol="guardar-nombre"]').addEventListener('click', guardar);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') guardar(); if (e.key === 'Escape') render(); });
  }

  async function eliminarLista(lista) {
    const confirmado = await Utils.confirm('¿Eliminar lista?', `Se va a eliminar "${lista.nombre}". Esta acción no se puede deshacer.`, 'Eliminar');
    if (!confirmado) return;
    try {
      const res = await window.sweetAuth.fetch(`/api/mayoristas-listas?id=${encodeURIComponent(lista.id)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo eliminar.');
      await cargarListas();
    } catch (err) {
      Utils.toast(err.message, 'error');
    }
  }

  async function agregarProducto(lista, producto) {
    try {
      const res = await window.sweetAuth.fetch(`/api/mayoristas-listas?id=${encodeURIComponent(lista.id)}&accion=agregar-producto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ producto_id: producto.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo agregar.');
      await cargarListas();
    } catch (err) {
      Utils.toast(err.message, 'error');
    }
  }

  async function quitarProducto(lista, productoId) {
    try {
      const res = await window.sweetAuth.fetch(`/api/mayoristas-listas?id=${encodeURIComponent(lista.id)}&accion=quitar-producto&producto_id=${encodeURIComponent(productoId)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo quitar.');
      await cargarListas();
    } catch (err) {
      Utils.toast(err.message, 'error');
    }
  }

  // ============================================
  // BUSCADOR (combobox) — mismo patrón que Recetas
  // ============================================
  function setupCombobox(card, lista) {
    const wrapper = card.querySelector('[data-rol="combobox"]');
    const input = wrapper.querySelector('[data-rol="search"]');
    const list = wrapper.querySelector('[data-rol="list"]');
    let activeIndex = -1;

    function normalize(s) {
      return (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    }

    function disponibles() {
      const idsEnLista = new Set(lista.productos.map(p => p.producto_id));
      return catalogoProductos.filter(p => !idsEnLista.has(p.id));
    }

    function filtered(query) {
      const q = normalize(query);
      const base = disponibles();
      if (!q) return base;
      return base.filter(p => normalize(p.nombre).includes(q));
    }

    function renderList(query) {
      const items = filtered(query);
      activeIndex = -1;
      if (items.length === 0) {
        list.innerHTML = '<div class="combobox__empty">Sin resultados</div>';
        list.hidden = false;
        return;
      }
      list.innerHTML = items.map(p => `<div class="combobox__option" data-id="${p.id}">${p.nombre}</div>`).join('');
      list.hidden = false;
      list.querySelectorAll('.combobox__option').forEach(opt => {
        opt.addEventListener('mousedown', (e) => {
          e.preventDefault();
          const item = catalogoProductos.find(p => p.id === opt.dataset.id);
          input.value = '';
          list.hidden = true;
          agregarProducto(lista, item);
        });
      });
    }

    input.addEventListener('input', () => renderList(input.value));
    input.addEventListener('focus', () => renderList(input.value));
    input.addEventListener('keydown', (e) => {
      const opts = () => list.querySelectorAll('.combobox__option');
      if (e.key === 'ArrowDown') { e.preventDefault(); if (list.hidden) { renderList(input.value); return; } activeIndex = Math.min(activeIndex + 1, opts().length - 1); marcarActivo(opts, activeIndex); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); activeIndex = Math.max(activeIndex - 1, 0); marcarActivo(opts, activeIndex); }
      else if (e.key === 'Enter') {
        if (!list.hidden && activeIndex >= 0) {
          e.preventDefault();
          opts()[activeIndex].dispatchEvent(new Event('mousedown'));
        }
      } else if (e.key === 'Escape') { list.hidden = true; }
    });
    document.addEventListener('click', (e) => {
      if (!wrapper.contains(e.target)) list.hidden = true;
    });

    function marcarActivo(opts, idx) {
      opts().forEach(o => o.classList.remove('is-active'));
      const el = opts()[idx];
      if (el) { el.classList.add('is-active'); el.scrollIntoView({ block: 'nearest' }); }
    }
  }

  async function crearLista() {
    const input = document.getElementById('new-lista-nombre');
    const nombre = input.value.trim();
    if (!nombre) { Utils.toast('Escribí el nombre de la lista', 'error'); return; }
    try {
      const res = await window.sweetAuth.fetch('/api/mayoristas-listas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo crear.');
      input.value = '';
      await cargarListas();
    } catch (err) {
      Utils.toast(err.message, 'error');
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    window.sweetAuth.onReady(async function () {
      document.getElementById('btn-add-lista').addEventListener('click', crearLista);
      document.getElementById('new-lista-nombre').addEventListener('keydown', e => { if (e.key === 'Enter') crearLista(); });
      await cargarCatalogo();
      await cargarListas();
    });
  });
})();
