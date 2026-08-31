// ============================================
// LISTAS DE PRECIOS — Borrador y publicación (Clientes / Mayoristas)
// ============================================

(function () {
  'use strict';

  const ICON_TRASH = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';

  let listaActual = 'clientes';
  let lineasActuales = [];
  // Ids tildados para el ajuste masivo — por defecto todos, se van
  // destildando los que no queremos que se toquen con el aumento general.
  let seleccionados = new Set();

  function fechaLegible(iso) {
    if (!iso) return 'Todavía no se publicó';
    const d = new Date(iso);
    return 'Publicado el ' + d.toLocaleDateString('es-AR') + ' a las ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  }

  function fechaCorta(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('es-AR');
  }

  function celdaDiferencia(l) {
    if (l.precio_publicado_anterior === null || l.precio_publicado_anterior === undefined) {
      return '<span class="cell--muted">Sin publicar antes</span>';
    }
    const anterior = `<span class="cell--muted cell--anterior">Antes: ${Utils.formatCurrency(l.precio_publicado_anterior)}</span>`;
    const dif = l.diferencia;
    if (dif === null) return anterior;
    const pct = l.precio_publicado_anterior > 0 ? (dif / l.precio_publicado_anterior) * 100 : 0;
    if (Math.abs(dif) < 0.01) return `${anterior} <span class="cell--muted">(sin cambios)</span>`;
    const clase = dif > 0 ? 'cell--pos' : 'cell--neg';
    const flecha = dif > 0 ? '▲' : '▼';
    const signo = dif > 0 ? '+' : '';
    return `${anterior} <span class="${clase}">${flecha} ${signo}${Utils.formatCurrency(dif)} (${signo}${pct.toFixed(1)}%)</span>`;
  }

  async function cargarBorrador() {
    const wrapper = document.getElementById('table-wrapper');
    wrapper.innerHTML = '<div class="empty-state"><p class="empty-state__text">Cargando...</p></div>';
    document.getElementById('btn-ver-publicada').href = `lista-publicada.html?lista=${listaActual}`;

    let data;
    try {
      const res = await window.sweetAuth.fetch(`/api/listas-precios?lista=${listaActual}&modo=borrador`);
      data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo cargar la lista.');
    } catch (err) {
      wrapper.innerHTML = `<div class="empty-state"><p class="empty-state__text">${err.message}</p></div>`;
      return;
    }

    document.getElementById('lista-publicada-info').textContent = fechaLegible(data.published_at);
    lineasActuales = data.borrador;
    // Por defecto arrancan todos tildados (solo los que sí existen todavía).
    seleccionados = new Set(lineasActuales.filter(l => l.existe).map(l => l.id));
    renderTabla();
  }

  function actualizarContador() {
    const el = document.getElementById('masivo-count');
    const total = lineasActuales.filter(l => l.existe).length;
    el.textContent = `${seleccionados.size} de ${total} producto(s) tildado(s)`;
  }

  function renderTabla() {
    const wrapper = document.getElementById('table-wrapper');

    if (lineasActuales.length === 0) {
      wrapper.innerHTML = `
        <div class="empty-state">
          <span class="empty-state__icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z"></path></svg></span>
          <h3 class="empty-state__title">El borrador está vacío</h3>
          <p class="empty-state__text">Tocá "Sincronizar desde Recetas" para traer los productos activos.</p>
        </div>
      `;
      document.getElementById('masivo-count').textContent = '';
      return;
    }

    const todosSeleccionables = lineasActuales.filter(l => l.existe);
    const todosTildados = todosSeleccionables.length > 0 && todosSeleccionables.every(l => seleccionados.has(l.id));

    let html = `
      <table class="data-table data-table--stack">
        <thead>
          <tr>
            <th class="check-cell"><input type="checkbox" id="check-todos" ${todosTildados ? 'checked' : ''}></th>
            <th>Producto</th>
            <th class="cell--currency">Precio Base (Recetas)</th>
            <th>Ajuste</th>
            <th class="cell--currency">Precio Final</th>
            <th>Actualizado</th>
            <th>vs. Última Publicación</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
    `;

    lineasActuales.forEach(l => {
      const roto = !l.existe;
      html += `
        <tr data-id="${l.id}" class="${roto ? 'fila-rota' : ''}">
          <td class="check-cell" data-label="">${roto ? '' : `<input type="checkbox" class="check-linea" data-id="${l.id}" ${seleccionados.has(l.id) ? 'checked' : ''}>`}</td>
          <td class="cell--title">${l.nombre}${roto ? ' <span class="cell--muted">(borrado en Recetas)</span>' : ''}</td>
          <td class="cell--currency" data-label="Precio Base">${roto ? '—' : Utils.formatCurrency(l.precio_base)}</td>
          <td data-label="Ajuste">
            ${roto ? '—' : `
            <div class="ajuste-cell">
              <select class="ajuste-tipo">
                <option value="monto" ${l.ajuste_tipo === 'monto' ? 'selected' : ''}>+ $</option>
                <option value="porcentaje" ${l.ajuste_tipo === 'porcentaje' ? 'selected' : ''}>+ %</option>
              </select>
              <input type="number" class="obl-inline-input obl-inline-input--sm ajuste-valor" step="0.01" value="${l.ajuste_valor}">
            </div>
            `}
          </td>
          <td class="cell--currency cell--precio" data-label="Precio Final">${roto ? '—' : Utils.formatCurrency(l.precio_final)}</td>
          <td data-label="Actualizado">${fechaCorta(l.updated_at)}</td>
          <td data-label="vs. Última Publicación">${roto ? '—' : celdaDiferencia(l)}</td>
          <td><button type="button" class="btn-row-delete btn-quitar" title="Quitar de esta lista" data-id="${l.id}" data-nombre="${l.nombre.replace(/"/g, '&quot;')}">${ICON_TRASH}</button></td>
        </tr>
      `;
    });

    html += '</tbody></table>';
    wrapper.innerHTML = html;
    actualizarContador();

    document.getElementById('check-todos').addEventListener('change', (e) => {
      if (e.target.checked) todosSeleccionables.forEach(l => seleccionados.add(l.id));
      else seleccionados.clear();
      renderTabla();
    });

    wrapper.querySelectorAll('.check-linea').forEach(chk => {
      chk.addEventListener('change', () => {
        if (chk.checked) seleccionados.add(chk.dataset.id);
        else seleccionados.delete(chk.dataset.id);
        actualizarContador();
        // Solo hace falta refrescar el check "todos" (no toda la tabla).
        const soloExistentes = lineasActuales.filter(l => l.existe);
        document.getElementById('check-todos').checked = soloExistentes.length > 0 && soloExistentes.every(l => seleccionados.has(l.id));
      });
    });

    wrapper.querySelectorAll('tr').forEach(tr => {
      const id = tr.dataset.id;
      if (!id) return;

      const selectTipo = tr.querySelector('.ajuste-tipo');
      const inputValor = tr.querySelector('.ajuste-valor');
      if (selectTipo && inputValor) {
        const guardarAjuste = () => guardarLinea(id, selectTipo.value, inputValor.value);
        selectTipo.addEventListener('change', guardarAjuste);
        inputValor.addEventListener('change', guardarAjuste);
      }

      const btnQuitar = tr.querySelector('.btn-quitar');
      if (btnQuitar) {
        btnQuitar.addEventListener('click', () => quitarLinea(id, btnQuitar.dataset.nombre));
      }
    });
  }

  async function guardarLinea(id, ajusteTipo, ajusteValor) {
    try {
      const res = await window.sweetAuth.fetch(`/api/listas-precios?id=${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ajuste_tipo: ajusteTipo, ajuste_valor: Number(ajusteValor) || 0 }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo guardar.');
      await cargarBorrador();
    } catch (err) {
      Utils.toast(err.message, 'error');
    }
  }

  async function quitarLinea(id, nombre) {
    const confirmado = await Utils.confirm('¿Quitar de esta lista?', `Se va a sacar "${nombre}" del borrador de ${listaActual}. El producto sigue existiendo en Recetas.`, 'Quitar');
    if (!confirmado) return;
    try {
      const res = await window.sweetAuth.fetch(`/api/listas-precios?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo quitar.');
      await cargarBorrador();
    } catch (err) {
      Utils.toast(err.message, 'error');
    }
  }

  async function sincronizar() {
    try {
      const res = await window.sweetAuth.fetch('/api/listas-precios?accion=sincronizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lista: listaActual }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo sincronizar.');
      Utils.toast(data.agregados > 0 ? `Se agregaron ${data.agregados} producto(s) nuevo(s)` : 'Ya estaba todo sincronizado', 'success');
      await cargarBorrador();
    } catch (err) {
      Utils.toast(err.message, 'error');
    }
  }

  async function aplicarAjusteMasivo() {
    const valor = Number(document.getElementById('masivo-valor').value);
    if (!isFinite(valor) || valor === 0) { Utils.toast('Escribí un porcentaje distinto de 0', 'error'); return; }
    if (seleccionados.size === 0) { Utils.toast('No hay ningún producto tildado', 'error'); return; }

    const confirmado = await Utils.confirm(
      `¿Aumentar ${valor}%?`,
      `Se le va a fijar un ajuste de +${valor}% (reemplazando el ajuste que tenían) a los ${seleccionados.size} producto(s) tildado(s) de esta lista.`,
      'Aplicar'
    );
    if (!confirmado) return;

    try {
      const res = await window.sweetAuth.fetch('/api/listas-precios?accion=ajuste-masivo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lista: listaActual, ids: Array.from(seleccionados), ajuste_tipo: 'porcentaje', ajuste_valor: valor }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo aplicar el ajuste.');
      Utils.toast(`✓ Aplicado a ${data.actualizados} producto(s)`, 'success');
      document.getElementById('masivo-valor').value = '';
      await cargarBorrador();
    } catch (err) {
      Utils.toast(err.message, 'error');
    }
  }

  async function publicar() {
    const nombreLista = listaActual === 'clientes' ? 'Clientes' : 'Mayoristas';
    const confirmado = await Utils.confirm(
      `¿Publicar lista de ${nombreLista}?`,
      'Los precios que se ven ahora en el borrador van a quedar fijos (congelados) hasta la próxima vez que publiques, sin importar que después cambien los costos.',
      'Publicar'
    );
    if (!confirmado) return;
    try {
      const res = await window.sweetAuth.fetch('/api/listas-precios?accion=publicar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lista: listaActual }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo publicar.');
      Utils.toast(`✓ Lista de ${nombreLista} publicada (${data.publicados} productos)`, 'success');
      await cargarBorrador();
    } catch (err) {
      Utils.toast(err.message, 'error');
    }
  }

  function cambiarTab(lista) {
    listaActual = lista;
    document.getElementById('tab-clientes').classList.toggle('is-active', lista === 'clientes');
    document.getElementById('tab-mayoristas').classList.toggle('is-active', lista === 'mayoristas');
    cargarBorrador();
  }

  document.addEventListener('DOMContentLoaded', function () {
    window.sweetAuth.onReady(function () {
      document.getElementById('tab-clientes').addEventListener('click', () => cambiarTab('clientes'));
      document.getElementById('tab-mayoristas').addEventListener('click', () => cambiarTab('mayoristas'));
      document.getElementById('btn-sincronizar').addEventListener('click', sincronizar);
      document.getElementById('btn-publicar').addEventListener('click', publicar);
      document.getElementById('btn-aplicar-masivo').addEventListener('click', aplicarAjusteMasivo);
      cargarBorrador();
    });
  });
})();
