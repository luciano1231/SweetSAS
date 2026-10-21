// ============================================
// MAYORISTAS — Libro Mayor (historial de remitos cerrados)
// ============================================

(function () {
  'use strict';

  const PALETA = ['#1d8a63', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#ef4444', '#14b8a6', '#f97316'];
  let clientes = [];
  let filasCargadas = [];
  // 'productos' = una fila por producto (libro mayor clásico);
  // 'remitos' = una fila por remito con su total.
  let vista = 'productos';
  let offset = 0;
  const LIMIT = 200;

  function colorPara(nombre, colorGuardado) {
    if (colorGuardado) return colorGuardado;
    let hash = 0;
    for (const ch of nombre) hash = (hash * 31 + ch.charCodeAt(0)) % PALETA.length;
    return PALETA[hash];
  }

  function fechaLegible(iso) {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('es-AR');
  }

  async function cargarClientes() {
    const res = await window.sweetAuth.fetch('/api/mayoristas-clientes');
    const data = await res.json();
    if (res.ok && data.ok) {
      clientes = data.clientes;
      const select = document.getElementById('filter-cliente');
      clientes.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.nombre;
        select.appendChild(opt);
      });
    }
  }

  function colorDeCliente(clienteId, nombreFallback) {
    const c = clientes.find(x => x.id === clienteId);
    return colorPara(c ? c.nombre : nombreFallback, c ? c.color : null);
  }

  function paramsActuales(extraOffset) {
    const p = new URLSearchParams();
    const cliente = document.getElementById('filter-cliente').value;
    const desde = document.getElementById('filter-desde').value;
    const hasta = document.getElementById('filter-hasta').value;
    if (cliente) p.set('cliente_id', cliente);
    if (desde) p.set('desde', desde);
    if (hasta) p.set('hasta', hasta);
    if (vista === 'remitos') p.set('agrupar', 'remito');
    p.set('limit', LIMIT);
    p.set('offset', extraOffset || 0);
    return p;
  }

  async function cargar(reiniciar) {
    const wrapper = document.getElementById('table-wrapper');
    if (reiniciar) {
      offset = 0;
      filasCargadas = [];
      wrapper.innerHTML = '<div class="empty-state"><p class="empty-state__text">Cargando...</p></div>';
    }

    let data;
    try {
      const res = await window.sweetAuth.fetch(`/api/mayoristas-ledger?${paramsActuales(offset)}`);
      data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo cargar el libro mayor.');
    } catch (err) {
      wrapper.innerHTML = `<div class="empty-state"><p class="empty-state__text">${err.message}</p></div>`;
      return;
    }

    filasCargadas = filasCargadas.concat(vista === 'remitos' ? data.remitos : data.filas);
    offset = filasCargadas.length;

    const montoEl = document.getElementById('monto-total');
    montoEl.hidden = vista !== 'remitos';
    if (vista === 'remitos') {
      montoEl.innerHTML = `${data.total} remito${data.total !== 1 ? 's' : ''} — Total: <strong>${Utils.formatCurrency(data.monto_total)}</strong>`;
      renderRemitos(data.total);
    } else {
      render(data.total);
    }
  }

  // "3/3" líneas marcadas → ✓, algunas → "1/3", ninguna → "—"
  function celdaEstado(marcadas, total) {
    if (marcadas >= total) return '<span class="estado-todos">✓</span>';
    if (marcadas > 0) return `<span class="estado-parcial">${marcadas}/${total}</span>`;
    return '<span class="estado-ninguno">—</span>';
  }

  function renderRemitos(total) {
    const wrapper = document.getElementById('table-wrapper');
    const btnMas = document.getElementById('btn-cargar-mas');

    if (filasCargadas.length === 0) {
      wrapper.innerHTML = '<div class="empty-state"><p class="empty-state__text">Todavía no hay ningún remito cerrado (o ninguno coincide con el filtro).</p></div>';
      btnMas.hidden = true;
      return;
    }

    let html = `
      <table class="data-table data-table--stack">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Remito N°</th>
            <th>Cliente</th>
            <th>Productos</th>
            <th>Unidades</th>
            <th>Total</th>
            <th>Enviado</th>
            <th>Recibido</th>
            <th>Pagado</th>
          </tr>
        </thead>
        <tbody>
    `;
    filasCargadas.forEach(r => {
      html += `
        <tr>
          <td class="cell--title" data-label="Fecha">${fechaLegible(r.fecha)}</td>
          <td data-label="Remito N°">${String(r.remito_numero).padStart(5, '0')}</td>
          <td data-label="Cliente"><span class="cliente-pill"><span class="cliente-dot" style="background:${colorDeCliente(r.cliente_id, r.cliente_nombre)};"></span>${r.cliente_nombre}</span></td>
          <td data-label="Productos">${r.productos}</td>
          <td data-label="Unidades">${Utils.formatNumber(r.unidades)}</td>
          <td class="cell--currency" data-label="Total" style="font-weight:700;">${Utils.formatCurrency(r.total)}</td>
          <td class="check-cell" data-label="Enviado">${celdaEstado(r.enviados, r.productos)}</td>
          <td class="check-cell" data-label="Recibido">${celdaEstado(r.recibidos, r.productos)}</td>
          <td class="check-cell" data-label="Pagado">${celdaEstado(r.pagados, r.productos)}</td>
        </tr>
      `;
    });
    html += '</tbody></table>';
    wrapper.innerHTML = html;

    btnMas.hidden = filasCargadas.length >= total;
  }

  function cambiarVista(nueva) {
    vista = nueva;
    document.getElementById('vista-productos').classList.toggle('is-active', nueva === 'productos');
    document.getElementById('vista-remitos').classList.toggle('is-active', nueva === 'remitos');
    cargar(true);
  }

  function render(total) {
    const wrapper = document.getElementById('table-wrapper');
    const btnMas = document.getElementById('btn-cargar-mas');

    if (filasCargadas.length === 0) {
      wrapper.innerHTML = '<div class="empty-state"><p class="empty-state__text">Todavía no hay ningún remito cerrado (o ninguno coincide con el filtro).</p></div>';
      btnMas.hidden = true;
      return;
    }

    let html = `
      <table class="data-table data-table--stack">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Remito N°</th>
            <th>Cliente</th>
            <th>Producto</th>
            <th>Precio unitario</th>
            <th>Cantidad</th>
            <th>Subtotal</th>
            <th>Enviado</th>
            <th>Recibido</th>
            <th>Pagado</th>
            <th>Observaciones</th>
          </tr>
        </thead>
        <tbody>
    `;
    filasCargadas.forEach(f => {
      const subtotal = Math.round(f.precio_unitario * f.cantidad * 100) / 100;
      html += `
        <tr data-id="${f.id}">
          <td class="cell--title" data-label="Fecha">${fechaLegible(f.fecha)}</td>
          <td data-label="Remito N°">${String(f.remito_numero).padStart(5, '0')}</td>
          <td data-label="Cliente"><span class="cliente-pill"><span class="cliente-dot" style="background:${colorDeCliente(f.cliente_id, f.cliente_nombre)};"></span>${f.cliente_nombre}</span></td>
          <td data-label="Producto">${f.nombre_producto}</td>
          <td class="cell--currency" data-label="Precio unitario">${Utils.formatCurrency(f.precio_unitario)}</td>
          <td data-label="Cantidad">${Utils.formatNumber(f.cantidad)}</td>
          <td class="cell--currency" data-label="Subtotal">${Utils.formatCurrency(subtotal)}</td>
          <td class="check-cell" data-label="Enviado"><input type="checkbox" class="campo-check" data-campo="enviado" ${f.enviado ? 'checked' : ''}></td>
          <td class="check-cell" data-label="Recibido"><input type="checkbox" class="campo-check" data-campo="recibido" ${f.recibido ? 'checked' : ''}></td>
          <td class="check-cell" data-label="Pagado"><input type="checkbox" class="campo-check" data-campo="pagado" ${f.pagado ? 'checked' : ''}></td>
          <td data-label="Observaciones"><input type="text" class="obl-inline-input campo-obs" value="${(f.observaciones || '').replace(/"/g, '&quot;')}" placeholder="—"></td>
        </tr>
      `;
    });
    html += '</tbody></table>';
    wrapper.innerHTML = html;

    wrapper.querySelectorAll('.campo-check').forEach(input => {
      input.addEventListener('change', () => guardarCampo(input.closest('tr').dataset.id, { [input.dataset.campo]: input.checked }));
    });
    wrapper.querySelectorAll('.campo-obs').forEach(input => {
      input.addEventListener('change', () => guardarCampo(input.closest('tr').dataset.id, { observaciones: input.value }));
    });

    btnMas.hidden = filasCargadas.length >= total;
  }

  async function guardarCampo(id, cambios) {
    try {
      const res = await window.sweetAuth.fetch(`/api/mayoristas-ledger?id=${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cambios),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo guardar.');
      const fila = filasCargadas.find(f => f.id === id);
      if (fila) Object.assign(fila, cambios);
    } catch (err) {
      Utils.toast(err.message, 'error');
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    window.sweetAuth.onReady(async function () {
      document.getElementById('filter-cliente').addEventListener('change', () => cargar(true));
      document.getElementById('filter-desde').addEventListener('change', () => cargar(true));
      document.getElementById('filter-hasta').addEventListener('change', () => cargar(true));
      document.getElementById('btn-cargar-mas').addEventListener('click', () => cargar(false));
      document.getElementById('vista-productos').addEventListener('click', () => cambiarVista('productos'));
      document.getElementById('vista-remitos').addEventListener('click', () => cambiarVista('remitos'));
      await cargarClientes();
      await cargar(true);
    });
  });
})();
