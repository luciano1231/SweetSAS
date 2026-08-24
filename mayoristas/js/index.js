// ============================================
// MAYORISTAS — Listado de Clientes
// ============================================

(function () {
  'use strict';

  const ICON_TRASH = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
  const ICON_CHECK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
  const ICON_X = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
  const PALETA = ['#1d8a63', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#ef4444', '#14b8a6', '#f97316'];

  let todosLosClientes = [];
  let listasDisponibles = [];

  function colorPara(cliente) {
    if (cliente.color) return cliente.color;
    let hash = 0;
    for (const ch of cliente.nombre) hash = (hash * 31 + ch.charCodeAt(0)) % PALETA.length;
    return PALETA[hash];
  }

  async function cargarListas() {
    const res = await window.sweetAuth.fetch('/api/mayoristas-listas');
    const data = await res.json();
    if (res.ok && data.ok) {
      listasDisponibles = data.listas;
      const select = document.getElementById('new-cli-lista');
      listasDisponibles.forEach(l => {
        const opt = document.createElement('option');
        opt.value = l.id;
        opt.textContent = `${l.nombre} (${l.productos.length} productos)`;
        select.appendChild(opt);
      });
    }
  }

  async function cargarClientes() {
    const wrapper = document.getElementById('table-wrapper');
    wrapper.innerHTML = '<div class="empty-state"><p class="empty-state__text">Cargando...</p></div>';

    try {
      const res = await window.sweetAuth.fetch('/api/mayoristas-clientes');
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudieron cargar los clientes.');
      todosLosClientes = data.clientes;
    } catch (err) {
      wrapper.innerHTML = `<div class="empty-state"><p class="empty-state__text">${err.message}</p></div>`;
      return;
    }

    renderTabla();
  }

  function renderTabla() {
    const wrapper = document.getElementById('table-wrapper');
    const mostrarDeshabilitados = document.getElementById('filter-deshabilitados').checked;
    const clientes = mostrarDeshabilitados ? todosLosClientes : todosLosClientes.filter(c => c.activo !== 0);

    if (todosLosClientes.length === 0) {
      wrapper.innerHTML = `
        <div class="empty-state">
          <span class="empty-state__icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg></span>
          <h3 class="empty-state__title">Todavía no hay clientes mayoristas</h3>
          <p class="empty-state__text">Creá el primero arriba.</p>
        </div>
      `;
      return;
    }

    if (clientes.length === 0) {
      wrapper.innerHTML = '<div class="empty-state"><p class="empty-state__text">No hay clientes habilitados. Tildá "Mostrar deshabilitados" arriba para verlos.</p></div>';
      return;
    }

    let html = `
      <table class="data-table data-table--stack">
        <thead>
          <tr>
            <th></th>
            <th>Cliente</th>
            <th>Lista de productos</th>
            <th>Próximo N° remito</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
    `;

    clientes.forEach(c => {
      const activo = c.activo !== 0;
      html += `
        <tr data-id="${c.id}" class="${activo ? '' : 'fila-inactiva'}">
          <td>
            <button type="button" class="btn-row-toggle btn-toggle-cli ${activo ? 'is-on' : 'is-off'}" title="${activo ? 'Activo — click para deshabilitar' : 'Deshabilitado — click para activar'}" data-id="${c.id}" data-activo="${activo ? 1 : 0}">
              ${activo ? ICON_CHECK : ICON_X}
            </button>
          </td>
          <td class="cell--title"><span class="cliente-pill"><span class="cliente-dot" style="background:${colorPara(c)};"></span>${c.nombre}</span></td>
          <td data-label="Lista">${c.lista_nombre || '<span class="cell--muted">Catálogo general (Mayoristas)</span>'}</td>
          <td data-label="Próximo N°">${String(c.proximo_remito_numero).padStart(5, '0')}</td>
          <td><button type="button" class="btn-row-delete btn-delete-cli" title="Eliminar" data-id="${c.id}" data-nombre="${c.nombre.replace(/"/g, '&quot;')}">${ICON_TRASH}</button></td>
        </tr>
      `;
    });

    html += '</tbody></table>';
    wrapper.innerHTML = html;

    wrapper.querySelectorAll('.data-table tbody tr').forEach(tr => {
      tr.addEventListener('click', (e) => {
        if (e.target.closest('.btn-delete-cli') || e.target.closest('.btn-toggle-cli')) return;
        location.href = `remito.html?cliente=${encodeURIComponent(tr.dataset.id)}`;
      });
    });
    wrapper.querySelectorAll('.btn-delete-cli').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        eliminarCliente(btn.dataset.id, btn.dataset.nombre);
      });
    });
    wrapper.querySelectorAll('.btn-toggle-cli').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleActivo(btn.dataset.id, btn.dataset.activo === '1');
      });
    });
  }

  async function toggleActivo(id, activoActual) {
    const nuevoValor = !activoActual;
    try {
      const res = await window.sweetAuth.fetch(`/api/mayoristas-clientes?id=${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: nuevoValor }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo actualizar.');
      const cliente = todosLosClientes.find(c => c.id === id);
      if (cliente) cliente.activo = nuevoValor ? 1 : 0;
      renderTabla();
    } catch (err) {
      Utils.toast(err.message, 'error');
    }
  }

  async function eliminarCliente(id, nombre) {
    const confirmado = await Utils.confirm('¿Eliminar cliente?', `Se va a eliminar "${nombre}" y su remito abierto (si tenía líneas cargadas sin cerrar). Esta acción no se puede deshacer.`, 'Eliminar');
    if (!confirmado) return;
    try {
      const res = await window.sweetAuth.fetch(`/api/mayoristas-clientes?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo eliminar.');
      Utils.toast('Cliente eliminado', 'success');
      await cargarClientes();
    } catch (err) {
      Utils.toast(err.message, 'error');
    }
  }

  async function crearCliente() {
    const nombre = document.getElementById('new-cli-nombre').value.trim();
    if (!nombre) { Utils.toast('Escribí el nombre del cliente', 'error'); return; }
    const listaId = document.getElementById('new-cli-lista').value || null;
    const numero = Number(document.getElementById('new-cli-numero').value) || 1;

    try {
      const res = await window.sweetAuth.fetch('/api/mayoristas-clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, lista_id: listaId, proximo_remito_numero: numero }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo crear.');
      location.href = `remito.html?cliente=${encodeURIComponent(data.id)}`;
    } catch (err) {
      Utils.toast(err.message, 'error');
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    window.sweetAuth.onReady(async function () {
      document.getElementById('btn-add-cli').addEventListener('click', crearCliente);
      document.getElementById('filter-deshabilitados').addEventListener('change', renderTabla);
      await cargarListas();
      await cargarClientes();
    });
  });
})();
